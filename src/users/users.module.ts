import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeBillingProfileController } from './me-billing-profile.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  TaxInvoice,
  TaxInvoiceSchema,
} from '../invoices/schemas/tax-invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: TaxInvoice.name, schema: TaxInvoiceSchema },
    ]),
  ],
  controllers: [UsersController, MeBillingProfileController],
  providers: [UsersService],
  exports: [UsersService], // Export service for use in other modules
})
export class UsersModule {}
