import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { CommerceHealthService } from '../commerce-health/commerce-health.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { NormalizedPaymentEvent } from '../payments/domain/payment-gateway';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { nextLateWatchAt } from './late-capture-watch';
import { RepairSweepsService } from './repair-sweeps.service';
import { OrderDocument } from './schemas/order.schema';
import { OrdersService } from './orders.service';

const DEFAULT_MIN_AGE_MINUTES = 60;
const DEFAULT_INTERVAL_MS = 300_000;

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
    private readonly commerceConfig: CommerceConfigService,
    private readonly ordersService: OrdersService,
    private readonly registry: PaymentGatewayRegistry,
    private readonly repairSweeps: RepairSweepsService,
    private readonly commerceHealth: CommerceHealthService,
  ) {}

  async reconcileOnce(now: Date = new Date()): Promise<ReconciliationSummary> {
    const olderThan = new Date(
      now.getTime() - this.minAgeMinutes() * 60 * 1000,
    );
    await this.ordersService.backfillPendingRecon(olderThan, now);
    const createdExpired = await this.expireCreated(now);
    const candidates = await this.ordersService.findDuePending(
      olderThan,
      now,
      this.batch(),
    );
    const summary: ReconciliationSummary = {
      examined: candidates.length,
      paid: 0,
      failed: 0,
      expired: createdExpired,
      skipped: 0,
    };

    for (const candidate of candidates) {
      try {
        const outcome = await this.reconcileOrder(candidate);
        if (outcome === 'skipped') {
          await this.ordersService.postponePending(
            this.ordersService.idOf(candidate),
            now,
            this.intervalMs(),
            this.maxAttempts(),
          );
        }
        summary[outcome] += 1;
      } catch (error) {
        summary.skipped += 1;
        await this.ordersService.postponePending(
          this.ordersService.idOf(candidate),
          now,
          this.intervalMs(),
          this.maxAttempts(),
        );
        this.logger.warn(
          `Reconciliation skipped order ${this.ordersService.idOf(candidate)}: ${
            error instanceof Error ? error.message : 'unexpected error'
          }`,
        );
      }
    }

    await this.watchLateCaptures(now);
    await this.repairSweeps.sweep(now);
    await this.commerceHealth.degradedTick(now);
    return summary;
  }

  private async expireCreated(now: Date): Promise<number> {
    const rows = await this.ordersService.findCreatedPastExpiry(
      now,
      this.batch(),
    );
    let expired = 0;
    for (const row of rows) {
      const updated = await this.ordersService.markOrderExpired(
        this.ordersService.idOf(row),
      );
      if (updated.status === OrderStatus.EXPIRED) {
        expired += 1;
      }
    }
    return expired;
  }

  private async watchLateCaptures(now: Date): Promise<void> {
    const hours = this.watchHours();
    if (hours <= 0) {
      return;
    }
    const due = await this.ordersService.findLateWatchDue(now, this.batch());
    for (const order of due) {
      const orderId = this.ordersService.idOf(order);
      const providerOrderId = order.providerOrderId?.trim();
      const provider = order.paymentProvider?.trim();
      const checksCompleted = (order.reconAttempts ?? 0) + 1;
      if (!providerOrderId || !provider) {
        await this.ordersService.scheduleLateWatch(
          orderId,
          null,
          checksCompleted,
        );
        continue;
      }
      try {
        const payments = await this.registry
          .get(provider)
          .fetchOrderPayments(providerOrderId);
        const captured = payments.find(
          payment =>
            payment.status === 'captured' &&
            payment.amount === order.amount &&
            payment.currency === 'INR',
        );
        if (captured) {
          await this.ordersService.markOrderPaid(orderId, {
            providerPaymentId: captured.providerPaymentId,
            proof: {
              source: 'RECON_FETCH',
              providerPaymentId: captured.providerPaymentId,
              amount: captured.amount,
              currency: captured.currency,
            },
          });
          continue;
        }
      } catch (error) {
        this.logger.warn(
          `Late watch skipped order ${orderId}: ${
            error instanceof Error ? error.message : 'unexpected error'
          }`,
        );
      }
      const expiredAt = order.expiredAt ?? now;
      await this.ordersService.scheduleLateWatch(
        orderId,
        nextLateWatchAt(expiredAt, checksCompleted, hours),
        checksCompleted,
      );
    }
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
      const expired = await this.ordersService.markOrderExpired(orderId, {
        lateWatchHours: this.watchHours(),
      });
      return expired.status === OrderStatus.EXPIRED ? 'expired' : 'skipped';
    }

    if (event.status === 'FAILED') {
      const failed = await this.ordersService.markOrderFailed(orderId);
      return failed.status === OrderStatus.FAILED ? 'failed' : 'skipped';
    }

    const expired = await this.ordersService.markOrderExpired(orderId, {
      lateWatchHours: this.watchHours(),
    });
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

  private intervalMs(): number {
    const raw = this.configService.get<string>('RECONCILIATION_INTERVAL_MS');
    if (raw == null || raw.trim() === '') {
      return DEFAULT_INTERVAL_MS;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1000) {
      return DEFAULT_INTERVAL_MS;
    }
    return value;
  }

  private batch(): number {
    return this.commerceConfig.settings.reconciliationBatch ?? 50;
  }

  private maxAttempts(): number {
    return this.commerceConfig.settings.reconciliationMaxAttempts ?? 12;
  }

  private watchHours(): number {
    return this.commerceConfig.settings.lateCaptureWatchHours ?? 72;
  }
}
