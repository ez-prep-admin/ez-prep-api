import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { RefundsService } from './refunds.service';

const DEFAULT_INTERVAL_MS = 300_000;
const MIN_INTERVAL_MS = 1_000;

@Injectable()
export class RefundReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RefundReconciliationScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private interval = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly commerceConfig: CommerceConfigService,
    private readonly refundsService: RefundsService,
  ) {}

  onModuleInit(): void {
    const settings = this.commerceConfig.settings;
    if (!settings.commerceEnabled || !settings.reconciliationEnabled) {
      return;
    }

    const intervalMs = this.intervalMs();
    this.interval = intervalMs;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async runOnce(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    const started = Date.now();
    try {
      await this.refundsService.reconcileInitiatedRefunds();
    } catch (error) {
      this.logger.warn(
        `Refund reconciliation pass failed: ${
          error instanceof Error ? error.message : 'unexpected error'
        }`,
      );
    } finally {
      const elapsed = Date.now() - started;
      if (this.interval > 0 && elapsed > this.interval / 2) {
        this.logger.warn(`Refund reconciliation pass took ${elapsed}ms`);
      }
      this.running = false;
    }
  }

  private intervalMs(): number {
    const raw = this.configService.get<string>('RECONCILIATION_INTERVAL_MS');
    if (raw == null || raw.trim() === '') {
      return DEFAULT_INTERVAL_MS;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < MIN_INTERVAL_MS) {
      return DEFAULT_INTERVAL_MS;
    }
    return value;
  }
}
