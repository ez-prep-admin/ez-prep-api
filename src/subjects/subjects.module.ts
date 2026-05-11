import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubjectsService } from './subjects.service';
import { SubjectsController } from './subjects.controller';
import { Subject, SubjectSchema } from './schemas/subject.schema';
import { TopicsModule } from '../topics/topics.module';
import { ExamsModule } from '../exams/exams.module';

/**
 * SubjectsModule
 *
 * NestJS module for managing subjects functionality in the application.
 * This module encapsulates all subject-related features including data persistence,
 * business logic, and HTTP endpoints.
 *
 * @module SubjectsModule
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
    TopicsModule,
    ExamsModule,
  ],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [
    SubjectsService,
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
  ],
})
export class SubjectsModule {}
