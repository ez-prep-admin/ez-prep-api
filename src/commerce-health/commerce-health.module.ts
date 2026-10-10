import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CommerceAuditLog,
  CommerceAuditLogSchema,
} from '../commerce-audit/schemas/commerce-audit-log.schema';
import {
  TaxInvoice,
  TaxInvoiceSchema,
} from '../invoices/schemas/tax-invoice.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Refund, RefundSchema } from '../refunds/schemas/refund.schema';
import {
  WebhookDeliveryStat,
  WebhookDeliveryStatSchema,
} from '../webhooks/schemas/webhook-delivery-stat.schema';
import {
  WebhookEvent,
  WebhookEventSchema,
} from '../webhooks/schemas/webhook-event.schema';
import { CommerceHealthController } from './commerce-health.controller';
import { CommerceHealthService } from './commerce-health.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
      { name: WebhookDeliveryStat.name, schema: WebhookDeliveryStatSchema },
      { name: TaxInvoice.name, schema: TaxInvoiceSchema },
      { name: CommerceAuditLog.name, schema: CommerceAuditLogSchema },
    ]),
  ],
  controllers: [CommerceHealthController],
  providers: [CommerceHealthService],
  exports: [CommerceHealthService],
})
export class CommerceHealthModule {}
