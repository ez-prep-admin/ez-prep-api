import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FakeGateway } from '../infrastructure/fake/fake.gateway';
import { RAZORPAY_ORDERS_CLIENT } from '../infrastructure/razorpay/razorpay-orders.client';
import { RazorpayGateway } from '../infrastructure/razorpay/razorpay.gateway';
import { PaymentGatewayRegistry } from './payment-gateway.registry';

describe('PaymentGatewayRegistry', () => {
  let registry: PaymentGatewayRegistry;
  const config = { get: jest.fn() };

  beforeEach(async () => {
    config.get.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentGatewayRegistry,
        FakeGateway,
        RazorpayGateway,
        { provide: ConfigService, useValue: config },
        {
          provide: RAZORPAY_ORDERS_CLIENT,
          useValue: { createOrder: jest.fn() },
        },
      ],
    }).compile();
    registry = module.get(PaymentGatewayRegistry);
  });

  it('returns the fake provider by default', () => {
    config.get.mockReturnValue(undefined);
    expect(registry.get().provider).toBe('fake');
  });

  it('returns the fake provider when PAYMENT_PROVIDER=fake', () => {
    config.get.mockReturnValue('fake');
    expect(registry.get().provider).toBe('fake');
  });

  it('rejects a provider that is not registered', () => {
    expect(() => registry.get('stripe')).toThrow(ServiceUnavailableException);
  });

  it('returns the razorpay provider when asked explicitly', () => {
    expect(registry.get('razorpay').provider).toBe('razorpay');
  });

  it('returns the razorpay provider when PAYMENT_PROVIDER=razorpay', () => {
    config.get.mockReturnValue('razorpay');
    expect(registry.get().provider).toBe('razorpay');
  });
});
