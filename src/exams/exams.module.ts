import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { Exam, ExamSchema } from './schemas/exam.schema';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
    CategoriesModule, // Import to access Category model
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [
    ExamsService,
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
  ],
})
export class ExamsModule {}
