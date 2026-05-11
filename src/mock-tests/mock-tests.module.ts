import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MockTestsService } from './mock-tests.service';
import { MockTestsController } from './mock-tests.controller';
import { MockTest, MockTestSchema } from './schemas/mock-test.schema';
import { SubjectsModule } from '../subjects/subjects.module';
import { TopicsModule } from '../topics/topics.module';
import { ExamsModule } from '../exams/exams.module';
import {
  MockTestAttempt,
  MockTestAttemptSchema,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MockTest.name, schema: MockTestSchema },
      { name: MockTestAttempt.name, schema: MockTestAttemptSchema },
    ]),
    SubjectsModule,
    TopicsModule,
    ExamsModule,
  ],
  controllers: [MockTestsController],
  providers: [MockTestsService],
  exports: [
    MockTestsService,
    MongooseModule.forFeature([
      { name: MockTest.name, schema: MockTestSchema },
    ]),
  ], // Export service and model for use in other modules
})
export class MockTestsModule {}
