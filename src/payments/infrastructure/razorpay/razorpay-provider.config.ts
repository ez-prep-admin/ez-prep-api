import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REQUIRED_WHEN_RAZORPAY = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

@Injectable()
export class RazorpayProviderConfig implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const selected = (
      this.configService.get<string>('PAYMENT_PROVIDER') ?? 'fake'
    ).trim();
    if ((selected || 'fake') !== 'razorpay') {
      return;
    }

    const missing = REQUIRED_WHEN_RAZORPAY.filter(
      name => !this.configService.get<string>(name)?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(
        `PAYMENT_PROVIDER=razorpay requires ${missing.join(', ')}`,
      );
    }
  }
}
