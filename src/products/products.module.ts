import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { ExamGroupsModule } from '../exam-groups/exam-groups.module';
import { ExamsModule } from '../exams/exams.module';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { OffersModule } from '../offers/offers.module';
import { AdminProductsController } from './admin-products.controller';
import { GrantValidationService } from './grant-validation.service';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  ProductVersion,
  ProductVersionSchema,
} from './schemas/product-version.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVersion.name, schema: ProductVersionSchema },
    ]),
    ExamsModule,
    ExamGroupsModule,
    forwardRef(() => MockTestsModule),
    forwardRef(() => OffersModule),
    CommerceAuditModule,
  ],
  controllers: [AdminProductsController],
  providers: [ProductsService, GrantValidationService],
  exports: [ProductsService, GrantValidationService, MongooseModule],
})
export class ProductsModule {}
