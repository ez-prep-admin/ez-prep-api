import { Module, forwardRef } from '@nestjs/common';
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
import {
  Question,
  QuestionSchema,
} from '../mock-test-attempts/schemas/question.schema';
import { AccessModule } from '../access/access-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MockTest.name, schema: MockTestSchema },
      { name: MockTestAttempt.name, schema: MockTestAttemptSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
    SubjectsModule,
    TopicsModule,
    ExamsModule,
    forwardRef(() => AccessModule),
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
