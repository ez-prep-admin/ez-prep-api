import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { CommerceConfigService } from './commerce-config.service';

@Injectable()
export class CommerceEnabledGuard implements CanActivate {
  constructor(private readonly commerceConfig: CommerceConfigService) {}

  canActivate(): boolean {
    if (this.commerceConfig.settings.commerceEnabled) {
      return true;
    }
    throw new NotFoundException({
      message: 'Commerce is not enabled',
      details: { code: 'COMMERCE_DISABLED' },
    });
  }
}
