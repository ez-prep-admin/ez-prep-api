import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WebhookEventStatus } from '../common/enums/webhook-event-status.enum';
import { OrdersService } from '../orders/orders.service';
import { RefundsService } from '../refunds/refunds.service';
import {
  NormalizedPaymentEvent,
  ProviderWebhookInput,
} from '../payments/domain/payment-gateway';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { payloadSha256 } from '../payments/infrastructure/razorpay/razorpay-signature';
import {
  WebhookEvent,
  WebhookEventDocument,
} from './schemas/webhook-event.schema';

export interface WebhookHandleResult {
  status: WebhookEventStatus;
}

@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookModel: Model<WebhookEventDocument>,
    private readonly registry: PaymentGatewayRegistry,
    private readonly ordersService: OrdersService,
    private readonly refundsService: RefundsService,
  ) {}

  async handle(input: ProviderWebhookInput): Promise<WebhookHandleResult> {
    const event = await this.registry.get('razorpay').parseWebhook(input);
    const claimed = await this.claim(event, payloadSha256(input.rawBody));
    if (claimed.duplicateTerminal) {
      this.logger.log(
        `razorpay ${event.eventType} ${event.providerEventId} duplicate`,
      );
      return { status: WebhookEventStatus.IGNORED };
    }

    const outcome = await this.apply(event);
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
  ): Promise<{ doc: WebhookEventDocument; duplicateTerminal: boolean }> {
    try {
      const doc = await this.webhookModel.create({
        provider: 'razorpay',
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        status: WebhookEventStatus.RECEIVED,
        payloadHash: hash,
        receivedAt: new Date(),
      });
      return { doc, duplicateTerminal: false };
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
        return { doc: existing, duplicateTerminal: true };
      }
      return { doc: existing, duplicateTerminal: false };
    }
  }

  private async apply(event: NormalizedPaymentEvent): Promise<{
    status: WebhookEventStatus;
    retry: boolean;
    error?: string;
  }> {
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

    const order = await this.ordersService.findByProviderOrderId(
      'razorpay',
      event.providerOrderId,
    );
    if (!order) {
      return {
        status: WebhookEventStatus.FAILED,
        retry: true,
        error: 'Order not found',
      };
    }
    if (event.amount !== order.amount || event.currency !== 'INR') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Amount or currency does not match the order',
      };
    }

    try {
      await this.ordersService.markOrderPaid(this.ordersService.idOf(order), {
        providerPaymentId: event.providerPaymentId,
      });
      return { status: WebhookEventStatus.PROCESSED, retry: false };
    } catch {
      return {
        status: WebhookEventStatus.FAILED,
        retry: true,
        error: 'Could not mark order paid',
      };
    }
  }

  private async applyRefund(event: NormalizedPaymentEvent): Promise<{
    status: WebhookEventStatus;
    retry: boolean;
    error?: string;
  }> {
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
      if (failed === 'missing') {
        return {
          status: WebhookEventStatus.FAILED,
          retry: true,
          error: 'Refund not found',
        };
      }
      return { status: WebhookEventStatus.PROCESSED, retry: false };
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
    if (settled === 'missing') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: true,
        error: 'Refund not found',
      };
    }
    if (settled === 'mismatch') {
      return {
        status: WebhookEventStatus.FAILED,
        retry: false,
        error: 'Amount or currency does not match the refund',
      };
    }
    return { status: WebhookEventStatus.PROCESSED, retry: false };
  }

  private async finish(
    doc: WebhookEventDocument,
    status: WebhookEventStatus,
    error?: string,
  ): Promise<void> {
    doc.status = status;
    doc.processedAt = new Date();
    doc.error = error;
    await doc.save();
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}
