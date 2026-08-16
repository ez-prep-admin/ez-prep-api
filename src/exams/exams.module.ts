import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { Exam, ExamSchema } from './schemas/exam.schema';
import { CategoriesModule } from '../categories/categories.module';
import { ExamGroupsModule } from '../exam-groups/exam-groups.module';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
    CategoriesModule, // Import to access Category model
    ExamGroupsModule, // Import to access ExamGroup model
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [
    ExamsService,
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
  ],
})
export class ExamsModule {}
