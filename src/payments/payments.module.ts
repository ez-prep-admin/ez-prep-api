import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentGatewayRegistry } from './domain/payment-gateway.registry';
import { FakeGateway } from './infrastructure/fake/fake.gateway';
import { Payment, PaymentSchema } from './schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  providers: [FakeGateway, PaymentGatewayRegistry],
  exports: [FakeGateway, PaymentGatewayRegistry, MongooseModule],
})
export class PaymentsModule {}
