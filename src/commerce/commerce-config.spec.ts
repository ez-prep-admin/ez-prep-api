import {
  parseCommerceSettings,
  productionCommerceBootError,
} from './commerce-config';

function env(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

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
};

describe('parseCommerceSettings', () => {
  it('enables commerce only for the exact string true', () => {
    expect(
      parseCommerceSettings(env({ COMMERCE_ENABLED: 'true' })).commerceEnabled,
    ).toBe(true);
    expect(
      parseCommerceSettings(env({ COMMERCE_ENABLED: ' TRUE ' }))
        .commerceEnabled,
    ).toBe(false);
    expect(parseCommerceSettings(env({})).commerceEnabled).toBe(false);
  });

  it('trims and uppercases the enforcement mode', () => {
    expect(
      parseCommerceSettings(env({ ACCESS_ENFORCEMENT_MODE: ' enforced ' }))
        .accessEnforcementMode,
    ).toBe('ENFORCED');
  });

  it('falls back to LEGACY with a warning outside a production commerce boot', () => {
    const settings = parseCommerceSettings(
      env({ NODE_ENV: 'test', ACCESS_ENFORCEMENT_MODE: 'ENFORCE' }),
    );
    expect(settings.accessEnforcementMode).toBe('LEGACY');
    expect(settings.accessModeWarning).toContain('ENFORCE');
  });

  it('rejects an unknown enforcement mode when production commerce is on', () => {
    expect(() =>
      parseCommerceSettings(
        env({ ...live, ACCESS_ENFORCEMENT_MODE: 'ENFORCE' }),
      ),
    ).toThrow(/ACCESS_ENFORCEMENT_MODE/);
  });
});

describe('productionCommerceBootError', () => {
  it('stays quiet when commerce is off', () => {
    const settings = parseCommerceSettings(
      env({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'fake' }),
    );
    expect(productionCommerceBootError(settings)).toBeNull();
  });

  it.each([
    ['PAYMENT_PROVIDER', { PAYMENT_PROVIDER: '' }],
    ['PAYMENT_PROVIDER', { PAYMENT_PROVIDER: 'fake' }],
    ['PAYMENT_PROVIDER', { PAYMENT_PROVIDER: 'stripe' }],
    ['RAZORPAY_KEY_ID', { RAZORPAY_KEY_ID: 'rzp_test_x' }],
    ['RAZORPAY_KEY_SECRET', { RAZORPAY_KEY_SECRET: '' }],
    ['RAZORPAY_WEBHOOK_SECRET', { RAZORPAY_WEBHOOK_SECRET: ' ' }],
    ['INSTANCE_ID', { INSTANCE_ID: '' }],
    ['INSTANCE_NAME', { INSTANCE_NAME: '' }],
    ['INVOICES_ENABLED', { INVOICES_ENABLED: 'false' }],
    ['RECONCILIATION_ENABLED', { RECONCILIATION_ENABLED: 'false' }],
  ])('names %s when production commerce is misconfigured', (_key, override) => {
    const settings = parseCommerceSettings(env({ ...live, ...override }));
    expect(productionCommerceBootError(settings)).toContain(_key);
  });

  it('accepts a trimmed lowercase razorpay provider with live keys', () => {
    const settings = parseCommerceSettings(
      env({ ...live, PAYMENT_PROVIDER: ' Razorpay ' }),
    );
    expect(settings.paymentProvider).toBe('razorpay');
    expect(productionCommerceBootError(settings)).toBeNull();
  });
});
