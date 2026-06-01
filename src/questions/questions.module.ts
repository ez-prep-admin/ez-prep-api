import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from './schemas/question.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Question.name, schema: QuestionSchema }]),
  ],
  exports: [
    MongooseModule.forFeature([{ name: Question.name, schema: QuestionSchema }]),
  ],
})
export class QuestionsModule {}
