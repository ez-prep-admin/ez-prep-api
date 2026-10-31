import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { ReconciliationService } from './reconciliation.service';

@Injectable()
export class ReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private interval = 0;

  constructor(
    private readonly commerceConfig: CommerceConfigService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  onModuleInit(): void {
    const settings = this.commerceConfig.settings;
    const intervalMs = settings.reconciliationIntervalMs;
    this.logger.log(
      `Commerce schedulers enabled=${
        settings.commerceEnabled && settings.reconciliationEnabled
      } interval=${intervalMs}ms batch=${settings.reconciliationBatch} maxAttempts=${settings.reconciliationMaxAttempts} lateWatchHours=${settings.lateCaptureWatchHours} webhookRetryMinutes=${settings.webhookRetryWindowMinutes} refundUnknownMinutes=${settings.refundUnknownWindowMinutes}`,
    );
    if (!settings.commerceEnabled || !settings.reconciliationEnabled) {
      return;
    }

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
      await this.reconciliation.reconcileOnce();
    } catch (error) {
      this.logger.warn(
        `Reconciliation pass failed: ${
          error instanceof Error ? error.message : 'unexpected error'
        }`,
      );
    } finally {
      const elapsed = Date.now() - started;
      if (this.interval > 0 && elapsed > this.interval / 2) {
        this.logger.warn(`Reconciliation pass took ${elapsed}ms`);
      }
      this.running = false;
    }
  }
}
