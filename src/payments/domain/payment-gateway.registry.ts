import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommerceConfigService } from '../../commerce/commerce-config.service';
import { PaymentGateway } from './payment-gateway';
import { FakeGateway } from '../infrastructure/fake/fake.gateway';
import { RazorpayGateway } from '../infrastructure/razorpay/razorpay.gateway';

@Injectable()
export class PaymentGatewayRegistry {
  constructor(
    private readonly commerceConfig: CommerceConfigService,
    private readonly razorpayGateway: RazorpayGateway,
    @Optional() private readonly fakeGateway?: FakeGateway,
  ) {}

  registeredProviders(): string[] {
    const names = ['razorpay'];
    if (this.fakeAvailable()) {
      names.unshift('fake');
    }
    return names;
  }

  isRegistered(provider: string): boolean {
    return this.registeredProviders().includes(provider.trim().toLowerCase());
  }

  get(provider?: string): PaymentGateway {
    const selected = (provider ?? this.commerceConfig.settings.paymentProvider)
      .trim()
      .toLowerCase();
    if (!selected) {
      throw new ServiceUnavailableException(
        'Payment provider "PAYMENT_PROVIDER" is not available',
      );
    }
    if (selected === 'fake') {
      if (!this.fakeAvailable() || !this.fakeGateway) {
        throw new ServiceUnavailableException(
          'Payment provider "fake" is not available',
        );
      }
      return this.fakeGateway;
    }
    if (selected === 'razorpay') {
      return this.razorpayGateway;
    }
    throw new ServiceUnavailableException(
      `Payment provider "${selected}" is not available`,
    );
  }

  private fakeAvailable(): boolean {
    return (
      this.commerceConfig.settings.nodeEnv !== 'production' &&
      this.fakeGateway != null
    );
  }
}
