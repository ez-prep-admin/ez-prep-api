import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SprintTestsController } from './sprint-tests.controller';
import { SprintTestsService } from './sprint-tests.service';
import {
  SprintTestDraft,
  SprintTestDraftSchema,
} from './schemas/sprint-test-draft.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import {
  Question,
  QuestionSchema,
} from '../mock-test-attempts/schemas/question.schema';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { AccessModule } from '../access/access-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SprintTestDraft.name, schema: SprintTestDraftSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
    MockTestsModule,
    AccessModule,
  ],
  controllers: [SprintTestsController],
  providers: [SprintTestsService],
  exports: [SprintTestsService],
})
export class SprintTestsModule {}
