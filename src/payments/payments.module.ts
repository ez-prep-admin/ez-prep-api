import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentGatewayRegistry } from './domain/payment-gateway.registry';
import { RegisteredPaymentProviderConstraint } from './domain/registered-payment-provider.constraint';
import { FakeGateway } from './infrastructure/fake/fake.gateway';
import { RazorpayProviderConfig } from './infrastructure/razorpay/razorpay-provider.config';
import { RAZORPAY_ORDERS_CLIENT } from './infrastructure/razorpay/razorpay-orders.client';
import { RazorpaySdkOrdersClient } from './infrastructure/razorpay/razorpay-sdk.client';
import { RazorpayGateway } from './infrastructure/razorpay/razorpay.gateway';
import { PaymentIndexRepair } from './payment-index.repair';
import { Payment, PaymentSchema } from './schemas/payment.schema';

const fakeGatewayEnabled = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  providers: [
    ...(fakeGatewayEnabled ? [FakeGateway] : []),
    RazorpayGateway,
    RazorpayProviderConfig,
    {
      provide: RAZORPAY_ORDERS_CLIENT,
      useFactory: (config: ConfigService) =>
        new RazorpaySdkOrdersClient(
          config.get<string>('RAZORPAY_KEY_ID')?.trim() ?? '',
          config.get<string>('RAZORPAY_KEY_SECRET')?.trim() ?? '',
        ),
      inject: [ConfigService],
    },
    PaymentGatewayRegistry,
    RegisteredPaymentProviderConstraint,
    PaymentIndexRepair,
  ],
  exports: [
    ...(fakeGatewayEnabled ? [FakeGateway] : []),
    RazorpayGateway,
    PaymentGatewayRegistry,
    RegisteredPaymentProviderConstraint,
    MongooseModule,
  ],
})
export class PaymentsModule {}
