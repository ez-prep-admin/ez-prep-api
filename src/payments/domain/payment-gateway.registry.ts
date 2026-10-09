import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway } from './payment-gateway';
import { FakeGateway } from '../infrastructure/fake/fake.gateway';
import { RazorpayGateway } from '../infrastructure/razorpay/razorpay.gateway';

@Injectable()
export class PaymentGatewayRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly fakeGateway: FakeGateway,
    private readonly razorpayGateway: RazorpayGateway,
  ) {}

  get(provider?: string): PaymentGateway {
    const selected = (
      provider ??
      this.configService.get<string>('PAYMENT_PROVIDER') ??
      'fake'
    ).trim();
    const name = selected || 'fake';

    if (name === 'fake') {
      return this.fakeGateway;
    }
    if (name === 'razorpay') {
      return this.razorpayGateway;
    }

    throw new ServiceUnavailableException(
      `Payment provider "${name}" is not available`,
    );
  }
}
