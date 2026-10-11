import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Entitlement,
  EntitlementSchema,
} from '../entitlements/schemas/entitlement.schema';
import {
  TaxInvoice,
  TaxInvoiceSchema,
} from '../invoices/schemas/tax-invoice.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Refund, RefundSchema } from '../refunds/schemas/refund.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AccountingController } from './accounting.controller';
import { AccountingSnapshotCache } from './accounting-snapshot.cache';
import { AccountingService } from './accounting.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Entitlement.name, schema: EntitlementSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
      { name: TaxInvoice.name, schema: TaxInvoiceSchema },
    ]),
  ],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingSnapshotCache],
})
export class AccountingModule {}
