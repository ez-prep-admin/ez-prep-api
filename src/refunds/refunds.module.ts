import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { OrdersModule } from '../orders/orders.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PaymentsModule } from '../payments/payments.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminOrdersController } from './admin-orders.controller';
import { RefundReconciliationScheduler } from './refund-reconciliation.scheduler';
import { RefundIndexRepair } from './refund-index.repair';
import { RefundsService } from './refunds.service';
import { Refund, RefundSchema } from './schemas/refund.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Refund.name, schema: RefundSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OrdersModule,
    PaymentsModule,
    EntitlementsModule,
    InvoicesModule,
    CommerceAuditModule,
  ],
  controllers: [AdminOrdersController],
  providers: [RefundsService, RefundReconciliationScheduler, RefundIndexRepair],
  exports: [RefundsService],
})
export class RefundsModule {}
