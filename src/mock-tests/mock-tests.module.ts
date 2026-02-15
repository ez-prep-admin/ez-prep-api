import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MockTestsService } from './mock-tests.service';
import { MockTestsController } from './mock-tests.controller';
import { MockTest, MockTestSchema } from './schemas/mock-test.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MockTest.name, schema: MockTestSchema },
    ]),
  ],
  controllers: [MockTestsController],
  providers: [MockTestsService],
  exports: [MockTestsService], // Export service for use in other modules
})
export class MockTestsModule {}
