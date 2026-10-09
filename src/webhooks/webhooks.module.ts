import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import {
  WebhookEvent,
  WebhookEventSchema,
} from './schemas/webhook-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    PaymentsModule,
    OrdersModule,
  ],
  controllers: [RazorpayWebhookController],
  providers: [RazorpayWebhookService],
})
export class WebhooksModule {}
