import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffersModule } from '../offers/offers.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { TaxModule } from '../tax/tax.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { NoopOrderPaidHandler } from './infrastructure/noop-order-paid.handler';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    PaymentsModule,
    OffersModule,
    ProductsModule,
    TaxModule,
  ],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    OrdersService,
    { provide: ORDER_PAID_HANDLER, useClass: NoopOrderPaidHandler },
  ],
  exports: [CheckoutService, OrdersService],
})
export class OrdersModule {}
