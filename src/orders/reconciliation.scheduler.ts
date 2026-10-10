import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { ReconciliationService } from './reconciliation.service';

const DEFAULT_INTERVAL_MS = 300_000;
const MIN_INTERVAL_MS = 1_000;

@Injectable()
export class ReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationScheduler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly commerceConfig: CommerceConfigService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  onModuleInit(): void {
    const settings = this.commerceConfig.settings;
    if (!settings.commerceEnabled || !settings.reconciliationEnabled) {
      this.logger.log('Order reconciliation is disabled');
      return;
    }

    const intervalMs = this.intervalMs();
    this.timer = setInterval(() => {
      void this.reconciliation.reconcileOnce().catch(error => {
        this.logger.warn(
          `Reconciliation pass failed: ${
            error instanceof Error ? error.message : 'unexpected error'
          }`,
        );
      });
    }, intervalMs);
    this.timer.unref?.();
    this.logger.log(`Order reconciliation every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
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
