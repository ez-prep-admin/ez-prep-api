import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { WebhookEventStatus } from '../common/enums/webhook-event-status.enum';
import { OrdersService } from '../orders/orders.service';
import { OrderDocument } from '../orders/schemas/order.schema';
import {
  NormalizedPaymentEvent,
  ProviderWebhookInput,
} from '../payments/domain/payment-gateway';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { payloadSha256 } from '../payments/infrastructure/razorpay/razorpay-signature';
import { RefundsService } from '../refunds/refunds.service';
import {
  WebhookDeliveryStat,
  WebhookDeliveryStatDocument,
  webhookRejectionHourId,
} from './schemas/webhook-delivery-stat.schema';
import {
  WebhookEvent,
  WebhookEventDocument,
} from './schemas/webhook-event.schema';

export interface WebhookHandleResult {
  status: WebhookEventStatus;
}

type ApplyOutcome = {
  status: WebhookEventStatus;
  retry: boolean;
  error?: string;
};

@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookModel: Model<WebhookEventDocument>,
    @InjectModel(WebhookDeliveryStat.name)
    private readonly deliveryStatModel: Model<WebhookDeliveryStatDocument>,
    private readonly registry: PaymentGatewayRegistry,
    private readonly ordersService: OrdersService,
    private readonly refundsService: RefundsService,
    private readonly commerceConfig: CommerceConfigService,
  ) {}

  async handle(input: ProviderWebhookInput): Promise<WebhookHandleResult> {
    let event: NormalizedPaymentEvent;
    try {
      event = await this.registry.get('razorpay').parseWebhook(input);
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.recordSignatureRejection();
      }
      throw error;
    }

    const claimed = await this.claim(event, payloadSha256(input.rawBody));
    if (claimed.duplicateTerminal) {
      this.logger.log(
        `razorpay ${event.eventType} ${event.providerEventId} duplicate`,
      );
      return {
        status: claimed.alreadyFailed
          ? WebhookEventStatus.FAILED
          : WebhookEventStatus.IGNORED,
      };
    }

    let outcome: ApplyOutcome;
    try {
      outcome = await this.apply(event);
    } catch (error) {
      outcome = {
        status: WebhookEventStatus.FAILED,
        retry: true,
        error: error instanceof Error ? error.message : 'Webhook apply failed',
      };
    }

    if (outcome.retry && !this.withinWindow(claimed.doc.receivedAt)) {
      outcome = {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: outcome.error ?? 'Webhook retry window elapsed',
      };
    }

    await this.finish(claimed.doc, outcome.status, outcome.error);
    this.logger.log(
      `razorpay ${event.eventType} ${event.providerEventId} order=${event.providerOrderId ?? '-'} ${outcome.status}`,
    );
    if (outcome.retry) {
      throw new InternalServerErrorException('Webhook processing failed');
    }
    return { status: outcome.status };
  }

  private async claim(
    event: NormalizedPaymentEvent,
    hash: string,
  ): Promise<{
    doc: WebhookEventDocument;
    duplicateTerminal: boolean;
    alreadyFailed: boolean;
  }> {
    try {
      const doc = await this.webhookModel.create({
        provider: 'razorpay',
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        status: WebhookEventStatus.RECEIVED,
        payloadHash: hash,
        receivedAt: new Date(),
        attempts: 0,
      });
      return { doc, duplicateTerminal: false, alreadyFailed: false };
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
      const existing = await this.webhookModel
        .findOne({
          provider: 'razorpay',
          providerEventId: event.providerEventId,
        })
        .exec();
      if (!existing) {
        throw error;
      }
      if (
        existing.status === WebhookEventStatus.PROCESSED ||
        existing.status === WebhookEventStatus.IGNORED
      ) {
        return { doc: existing, duplicateTerminal: true, alreadyFailed: false };
      }
      if (
        existing.status === WebhookEventStatus.FAILED &&
        !this.withinWindow(existing.receivedAt)
      ) {
        return { doc: existing, duplicateTerminal: true, alreadyFailed: true };
      }
      return { doc: existing, duplicateTerminal: false, alreadyFailed: false };
    }
  }

  private async apply(event: NormalizedPaymentEvent): Promise<ApplyOutcome> {
    const instanceId = this.commerceConfig.settings.instanceId;
    if (
      instanceId &&
      event.notesInstanceId &&
      event.notesInstanceId !== instanceId
    ) {
      return {
        status: WebhookEventStatus.IGNORED,
        retry: false,
        error: 'other_instance',
      };
    }

    if (
      event.status === 'REFUND_PROCESSED' ||
      event.status === 'REFUND_FAILED'
    ) {
      return this.applyRefund(event);
    }
    if (event.status !== 'CAPTURED') {
      return { status: WebhookEventStatus.IGNORED, retry: false };
    }
    if (!event.providerOrderId || !event.providerPaymentId) {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Capture event missing payment identifiers',
      };
    }

    const resolved = await this.findCaptureOrder(event);
    if (resolved.otherInstance) {
      return {
        status: WebhookEventStatus.IGNORED,
        retry: false,
        error: 'other_instance',
      };
    }
    if (!resolved.order) {
      if (!resolved.hadNotes) {
        return {
          status: WebhookEventStatus.IGNORED,
          retry: false,
          error: 'foreign_payment',
        };
      }
      return {
        status: WebhookEventStatus.FAILED,
        retry: true,
        error: 'Order not found',
      };
    }

    const order = resolved.order;
    if (event.amount !== order.amount || event.currency !== 'INR') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Amount or currency does not match the order',
      };
    }

    await this.ordersService.markOrderPaid(this.ordersService.idOf(order), {
      providerPaymentId: event.providerPaymentId,
      proof: {
        source: 'WEBHOOK',
        providerPaymentId: event.providerPaymentId,
        amount: event.amount ?? order.amount,
        currency: event.currency ?? 'INR',
      },
    });
    return { status: WebhookEventStatus.PROCESSED, retry: false };
  }

  private async findCaptureOrder(event: NormalizedPaymentEvent): Promise<{
    order: OrderDocument | null;
    hadNotes: boolean;
    otherInstance: boolean;
  }> {
    let hadNotes = Boolean(event.notesOrderId);
    if (event.providerOrderId) {
      const byProvider = await this.ordersService.findByProviderOrderId(
        'razorpay',
        event.providerOrderId,
      );
      if (byProvider) {
        return { order: byProvider, hadNotes, otherInstance: false };
      }
    }
    if (event.notesOrderId) {
      const byNotes = await this.ordersService.findById(event.notesOrderId);
      if (byNotes) {
        return { order: byNotes, hadNotes: true, otherInstance: false };
      }
      hadNotes = true;
    }

    const gateway = this.registry.get('razorpay');
    let providerOrderId = event.providerOrderId;
    if (!providerOrderId && event.providerPaymentId) {
      const payment = await gateway.fetchPayment(event.providerPaymentId);
      if (payment.notesOrderId) {
        hadNotes = true;
        const byPaymentNotes = await this.ordersService.findById(
          payment.notesOrderId,
        );
        if (byPaymentNotes) {
          return {
            order: byPaymentNotes,
            hadNotes: true,
            otherInstance: false,
          };
        }
      }
      providerOrderId = payment.providerOrderId;
    }
    if (!providerOrderId) {
      return { order: null, hadNotes, otherInstance: false };
    }

    const notes = await gateway.fetchProviderOrderNotes(providerOrderId);
    const instanceId = this.commerceConfig.settings.instanceId;
    if (
      instanceId &&
      notes.notesInstanceId &&
      notes.notesInstanceId !== instanceId
    ) {
      return { order: null, hadNotes, otherInstance: true };
    }
    if (notes.notesOrderId) {
      hadNotes = true;
      const byFetchedNotes = await this.ordersService.findById(
        notes.notesOrderId,
      );
      if (byFetchedNotes) {
        return { order: byFetchedNotes, hadNotes: true, otherInstance: false };
      }
    }
    return { order: null, hadNotes, otherInstance: false };
  }

  private async applyRefund(
    event: NormalizedPaymentEvent,
  ): Promise<ApplyOutcome> {
    if (!event.providerRefundId) {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Refund event missing refund id',
      };
    }

    if (event.status === 'REFUND_FAILED') {
      const failed = await this.refundsService.settleFailed(
        event.providerRefundId,
      );
      if (failed !== 'missing') {
        return { status: WebhookEventStatus.PROCESSED, retry: false };
      }
      return this.recoverRefund(event);
    }

    if (event.amount == null || event.currency !== 'INR') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Amount or currency does not match the refund',
      };
    }

    const settled = await this.refundsService.settleProcessed(
      event.providerRefundId,
      event.amount,
      event.currency,
    );
    if (settled === 'mismatch') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Amount or currency does not match the refund',
      };
    }
    if (settled !== 'missing') {
      return { status: WebhookEventStatus.PROCESSED, retry: false };
    }
    return this.recoverRefund(event);
  }

  private async recoverRefund(
    event: NormalizedPaymentEvent,
  ): Promise<ApplyOutcome> {
    const recover = this.refundsService.recoverRefundWebhook;
    if (typeof recover !== 'function') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: true,
        error: 'Refund not found',
      };
    }
    const recovered = await this.refundsService.recoverRefundWebhook({
      providerRefundId: event.providerRefundId ?? '',
      providerPaymentId: event.providerPaymentId,
      amount: event.amount ?? 0,
      currency: event.currency ?? '',
      failed: event.status === 'REFUND_FAILED',
    });
    if (recovered.action === 'ignore') {
      return {
        status: WebhookEventStatus.IGNORED,
        retry: false,
        error: recovered.reason,
      };
    }
    if (recovered.action === 'failed') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: recovered.error,
      };
    }
    if (recovered.action === 'processed') {
      return { status: WebhookEventStatus.PROCESSED, retry: false };
    }
    return {
      status: WebhookEventStatus.FAILED,
      retry: true,
      error: 'Refund not found',
    };
  }

  private async finish(
    doc: WebhookEventDocument,
    status: WebhookEventStatus,
    error?: string,
  ): Promise<void> {
    doc.status = status;
    doc.processedAt = new Date();
    doc.lastAttemptAt = doc.processedAt;
    doc.attempts = (doc.attempts ?? 0) + 1;
    doc.error = error;
    doc.lastError = error;
    await doc.save();
  }

  private withinWindow(receivedAt: Date, now = new Date()): boolean {
    const minutes =
      this.commerceConfig.settings.webhookRetryWindowMinutes ?? 30;
    return now.getTime() - receivedAt.getTime() < minutes * 60 * 1000;
  }

  private async recordSignatureRejection(): Promise<void> {
    try {
      await this.deliveryStatModel.updateOne(
        { _id: webhookRejectionHourId(new Date()) },
        { $inc: { count: 1 } },
        { upsert: true },
      );
    } catch (error) {
      this.logger.warn(
        `Webhook signature counter failed: ${
          error instanceof Error ? error.message : 'unexpected error'
        }`,
      );
    }
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
