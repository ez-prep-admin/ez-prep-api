import { Module } from '@nestjs/common';
import { AdminQuestionsController } from './questions.controller';
import { AdminQuestionsService } from './questions.service';
import { QuestionsModule } from '../questions.module';
import { SubjectsModule } from '../../subjects/subjects.module';
import { TopicsModule } from '../../topics/topics.module';
import { ExamsModule } from '../../exams/exams.module';
import { TagsModule } from '../../tags/tags.module';

@Module({
  imports: [
    QuestionsModule,
    SubjectsModule,
    TopicsModule,
    ExamsModule,
    TagsModule,
  ],
  controllers: [AdminQuestionsController],
  providers: [AdminQuestionsService],
})
export class AdminQuestionsModule {}
