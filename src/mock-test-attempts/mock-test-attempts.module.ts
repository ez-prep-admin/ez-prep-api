import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MockTestAttemptsService } from './mock-test-attempts.service';
import { MockTestAttemptsController } from './mock-test-attempts.controller';
import {
  MockTestAttempt,
  MockTestAttemptSchema,
} from './schemas/mock-test-attempt.schema';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MockTestAttempt.name, schema: MockTestAttemptSchema },
    ]),
    QuestionsModule,
    MockTestsModule, // Import to access MockTest model
  ],
  controllers: [MockTestAttemptsController],
  providers: [MockTestAttemptsService],
  exports: [MockTestAttemptsService],
})
export class MockTestAttemptsModule {}
