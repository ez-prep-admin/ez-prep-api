import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '../common/enums/order-status.enum';
import { NormalizedPaymentEvent } from '../payments/domain/payment-gateway';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { OrderDocument } from './schemas/order.schema';
import { OrdersService } from './orders.service';

const BATCH_LIMIT = 50;
const DEFAULT_MIN_AGE_MINUTES = 60;

export type ReconciliationOutcome = 'paid' | 'failed' | 'expired' | 'skipped';

export type ReconciliationSummary = {
  examined: number;
  paid: number;
  failed: number;
  expired: number;
  skipped: number;
};

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly registry: PaymentGatewayRegistry,
  ) {}

  async reconcileOnce(now: Date = new Date()): Promise<ReconciliationSummary> {
    const olderThan = new Date(
      now.getTime() - this.minAgeMinutes() * 60 * 1000,
    );
    const candidates = await this.ordersService.findStalePending(
      olderThan,
      BATCH_LIMIT,
    );
    const summary: ReconciliationSummary = {
      examined: candidates.length,
      paid: 0,
      failed: 0,
      expired: 0,
      skipped: 0,
    };

    for (const candidate of candidates) {
      try {
        const outcome = await this.reconcileOrder(candidate);
        summary[outcome] += 1;
      } catch (error) {
        summary.skipped += 1;
        this.logger.warn(
          `Reconciliation skipped order ${this.ordersService.idOf(candidate)}: ${
            error instanceof Error ? error.message : 'unexpected error'
          }`,
        );
      }
    }

    return summary;
  }

  private async reconcileOrder(
    candidate: OrderDocument,
  ): Promise<ReconciliationOutcome> {
    const orderId = this.ordersService.idOf(candidate);
    const order = await this.ordersService.findById(orderId);
    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
      return 'skipped';
    }

    const providerOrderId = order.providerOrderId?.trim();
    const provider = order.paymentProvider?.trim();
    if (!providerOrderId || !provider) {
      this.logger.warn(
        `Reconciliation skipped order ${orderId}: missing provider order`,
      );
      return 'skipped';
    }

    let event: NormalizedPaymentEvent;
    try {
      event = await this.registry
        .get(provider)
        .fetchOrderStatus(providerOrderId);
    } catch {
      this.logger.warn(
        `Reconciliation skipped order ${orderId}: provider status unavailable`,
      );
      return 'skipped';
    }

    if (event.status === 'CAPTURED') {
      if (
        !event.providerPaymentId ||
        event.amount !== order.amount ||
        event.currency !== 'INR'
      ) {
        this.logger.warn(
          `Reconciliation left order ${orderId} pending: capture does not match`,
        );
        return 'skipped';
      }
      await this.ordersService.markOrderPaid(orderId, {
        providerPaymentId: event.providerPaymentId,
        proof: {
          source: 'RECON_FETCH',
          providerPaymentId: event.providerPaymentId,
          amount: event.amount,
          currency: event.currency,
        },
      });
      return 'paid';
    }

    if (event.status === 'FAILED' && provider === 'razorpay') {
      const expired = await this.ordersService.markOrderExpired(orderId);
      return expired.status === OrderStatus.EXPIRED ? 'expired' : 'skipped';
    }

    if (event.status === 'FAILED') {
      const failed = await this.ordersService.markOrderFailed(orderId);
      return failed.status === OrderStatus.FAILED ? 'failed' : 'skipped';
    }

    const expired = await this.ordersService.markOrderExpired(orderId);
    return expired.status === OrderStatus.EXPIRED ? 'expired' : 'skipped';
  }

  private minAgeMinutes(): number {
    const raw = this.configService.get<string>(
      'RECONCILIATION_MIN_AGE_MINUTES',
    );
    if (raw == null || raw.trim() === '') {
      return DEFAULT_MIN_AGE_MINUTES;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      return DEFAULT_MIN_AGE_MINUTES;
    }
    return value;
  }
}
