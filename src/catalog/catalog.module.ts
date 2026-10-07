import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestSchema,
} from '../mock-tests/schemas/mock-test.schema';
import { OffersModule } from '../offers/offers.module';
import { ProductsModule } from '../products/products.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [
    ProductsModule,
    OffersModule,
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: MockTest.name, schema: MockTestSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
