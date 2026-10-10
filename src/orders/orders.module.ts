import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OffersModule } from '../offers/offers.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { TaxModule } from '../tax/tax.module';
import { CheckoutController } from './checkout.controller';
import { MeOrdersController } from './me-orders.controller';
import { CheckoutThrottlerGuard } from './checkout-throttler.guard';
import { CheckoutService } from './checkout.service';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { ProvisioningOrderPaidHandler } from './infrastructure/provisioning-order-paid.handler';
import { OrdersService } from './orders.service';
import { ReconciliationScheduler } from './reconciliation.scheduler';
import { ReconciliationService } from './reconciliation.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    PaymentsModule,
    CommerceAuditModule,
    OffersModule,
    ProductsModule,
    TaxModule,
    EntitlementsModule,
  ],
  controllers: [CheckoutController, MeOrdersController],
  providers: [
    CheckoutService,
    OrdersService,
    ReconciliationService,
    ReconciliationScheduler,
    CheckoutThrottlerGuard,
    { provide: ORDER_PAID_HANDLER, useClass: ProvisioningOrderPaidHandler },
  ],
  exports: [CheckoutService, OrdersService],
})
export class OrdersModule {}
