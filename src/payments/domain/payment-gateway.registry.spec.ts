import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CommerceConfigService } from '../../commerce/commerce-config.service';
import { FakeGateway } from '../infrastructure/fake/fake.gateway';
import { RAZORPAY_ORDERS_CLIENT } from '../infrastructure/razorpay/razorpay-orders.client';
import { RazorpayGateway } from '../infrastructure/razorpay/razorpay.gateway';
import { PaymentGatewayRegistry } from './payment-gateway.registry';

describe('PaymentGatewayRegistry', () => {
  let registry: PaymentGatewayRegistry;
  const settings = { paymentProvider: '', nodeEnv: 'test' };

  beforeEach(async () => {
    settings.paymentProvider = '';
    settings.nodeEnv = 'test';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentGatewayRegistry,
        FakeGateway,
        RazorpayGateway,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: CommerceConfigService,
          useValue: { settings },
        },
        {
          provide: RAZORPAY_ORDERS_CLIENT,
          useValue: { createOrder: jest.fn() },
        },
      ],
    }).compile();
    registry = module.get(PaymentGatewayRegistry);
  });

  it('rejects a blank provider instead of falling back to fake', () => {
    expect(() => registry.get()).toThrow(ServiceUnavailableException);
  });

  it('returns the fake provider when PAYMENT_PROVIDER=fake', () => {
    settings.paymentProvider = 'fake';
    expect(registry.get().provider).toBe('fake');
  });

  it('rejects a provider that is not registered', () => {
    expect(() => registry.get('stripe')).toThrow(ServiceUnavailableException);
  });

  it('returns the razorpay provider when asked explicitly', () => {
    expect(registry.get('razorpay').provider).toBe('razorpay');
  });

  it('returns the razorpay provider when PAYMENT_PROVIDER=razorpay', () => {
    settings.paymentProvider = 'razorpay';
    expect(registry.get().provider).toBe('razorpay');
  });

  it('does not serve fake when NODE_ENV is production', () => {
    settings.nodeEnv = 'production';
    settings.paymentProvider = 'fake';
    expect(() => registry.get()).toThrow(ServiceUnavailableException);
    expect(() => registry.get('fake')).toThrow(ServiceUnavailableException);
  });
});
