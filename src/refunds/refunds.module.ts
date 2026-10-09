import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { OrdersModule } from '../orders/orders.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PaymentsModule } from '../payments/payments.module';
import { AdminOrdersController } from './admin-orders.controller';
import { RefundsService } from './refunds.service';
import { Refund, RefundSchema } from './schemas/refund.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Refund.name, schema: RefundSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    OrdersModule,
    PaymentsModule,
    EntitlementsModule,
    InvoicesModule,
    CommerceAuditModule,
  ],
  controllers: [AdminOrdersController],
  providers: [RefundsService],
})
export class RefundsModule {}
