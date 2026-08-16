import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Question,
  QuestionSchema,
} from '../mock-test-attempts/schemas/question.schema';
import {
  FailedQuestion,
  FailedQuestionSchema,
} from '../imports/schemas/failed-question.schema';
import {
  MockTest,
  MockTestSchema,
} from '../mock-tests/schemas/mock-test.schema';
import {
  FullMockTestDraft,
  FullMockTestDraftSchema,
} from '../full-mock-tests/schemas/full-mock-test-draft.schema';
import {
  MockTestAttempt,
  MockTestAttemptSchema,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { Tag, TagSchema } from '../tags/schemas/tag.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: FailedQuestion.name, schema: FailedQuestionSchema },
      { name: MockTest.name, schema: MockTestSchema },
      { name: FullMockTestDraft.name, schema: FullMockTestDraftSchema },
      { name: MockTestAttempt.name, schema: MockTestAttemptSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Topic.name, schema: TopicSchema },
      { name: Tag.name, schema: TagSchema },
    ]),
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
