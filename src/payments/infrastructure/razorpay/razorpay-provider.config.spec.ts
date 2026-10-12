import { ConfigService } from '@nestjs/config';
import { RazorpayProviderConfig } from './razorpay-provider.config';

describe('RazorpayProviderConfig', () => {
  function check(values: Record<string, string | undefined>) {
    const config = {
      get: (key: string) => values[key],
    } as ConfigService;
    return new RazorpayProviderConfig(config);
  }

  it('allows a fake provider with blank Razorpay keys', () => {
    expect(() =>
      check({ PAYMENT_PROVIDER: 'fake' }).onModuleInit(),
    ).not.toThrow();
  });

  it('fails boot when razorpay is selected and a secret is missing', () => {
    expect(() =>
      check({
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_key',
        RAZORPAY_KEY_SECRET: 'secret',
      }).onModuleInit(),
    ).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
  });

  it('boots when razorpay keys are present', () => {
    expect(() =>
      check({
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_key',
        RAZORPAY_KEY_SECRET: 'secret',
        RAZORPAY_WEBHOOK_SECRET: 'whsec',
      }).onModuleInit(),
    ).not.toThrow();
  });
});
