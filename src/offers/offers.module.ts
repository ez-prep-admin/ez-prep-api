import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { ProductsModule } from '../products/products.module';
import { AdminOffersController } from './admin-offers.controller';
import { AdminProductOffersController } from './admin-product-offers.controller';
import { OffersService } from './offers.service';
import { Offer, OfferSchema } from './schemas/offer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    forwardRef(() => ProductsModule),
    CommerceAuditModule,
  ],
  controllers: [AdminProductOffersController, AdminOffersController],
  providers: [OffersService],
  exports: [OffersService, MongooseModule],
})
export class OffersModule {}
