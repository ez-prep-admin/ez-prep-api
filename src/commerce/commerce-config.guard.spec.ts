import { Logger } from '@nestjs/common';
import {
  LEGACY_WHILE_SELLING_WARNING,
  parseCommerceSettings,
} from './commerce-config';
import { CommerceConfigGuard } from './commerce-config.guard';
import { CommerceConfigService } from './commerce-config.service';

const live = {
  NODE_ENV: 'production',
  COMMERCE_ENABLED: 'true',
  PAYMENT_PROVIDER: 'razorpay',
  RAZORPAY_KEY_ID: 'rzp_live_test',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'hook',
  INSTANCE_ID: 'ezprep',
  INSTANCE_NAME: 'EZ Prep',
  INVOICES_ENABLED: 'true',
  RECONCILIATION_ENABLED: 'true',
  ACCESS_ENFORCEMENT_MODE: 'LEGACY',
  TRUST_PROXY_HOPS: '1',
};

function boot(values: Record<string, string>) {
  const settings = parseCommerceSettings({ get: key => values[key] });
  const guard = new CommerceConfigGuard({
    settings,
  } as CommerceConfigService);
  guard.onModuleInit();
}

describe('CommerceConfigGuard', () => {
  it('warns when production commerce is still LEGACY and still boots', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    expect(() => boot(live)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(LEGACY_WHILE_SELLING_WARNING);

    warn.mockRestore();
  });

  it('does not warn for production ENFORCED', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    boot({ ...live, ACCESS_ENFORCEMENT_MODE: 'ENFORCED' });
    expect(warn).not.toHaveBeenCalledWith(LEGACY_WHILE_SELLING_WARNING);

    warn.mockRestore();
  });
});
