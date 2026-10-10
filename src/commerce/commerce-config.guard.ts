import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { productionCommerceBootError } from './commerce-config';
import { CommerceConfigService } from './commerce-config.service';

@Injectable()
export class CommerceConfigGuard implements OnModuleInit {
  private readonly logger = new Logger(CommerceConfigGuard.name);

  constructor(private readonly commerceConfig: CommerceConfigService) {}

  onModuleInit(): void {
    const settings = this.commerceConfig.settings;
    const error = productionCommerceBootError(settings);
    if (error) {
      throw new Error(error);
    }

    this.logger.log(
      `commerceEnabled=${settings.commerceEnabled} provider=${settings.paymentProvider || '-'} invoicesEnabled=${settings.invoicesEnabled} reconciliationEnabled=${settings.reconciliationEnabled} accessMode=${settings.accessEnforcementMode} instanceId=${settings.instanceId || '-'} trustProxyHops=${settings.trustProxyHops}`,
    );
    if (settings.accessModeWarning) {
      this.logger.warn(settings.accessModeWarning);
    }
    if (settings.nodeEnv === 'production' && settings.trustProxyHops === 0) {
      this.logger.warn(
        'TRUST_PROXY_HOPS is 0 in production; client IP limits stay on the proxy address',
      );
    }
  }
}
