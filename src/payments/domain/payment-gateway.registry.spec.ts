import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FakeGateway } from '../infrastructure/fake/fake.gateway';
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
        { provide: ConfigService, useValue: config },
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

  it('rejects a provider that is not registered yet', () => {
    expect(() => registry.get('razorpay')).toThrow(ServiceUnavailableException);
  });
});
