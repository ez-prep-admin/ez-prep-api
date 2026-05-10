import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubjectsService } from './subjects.service';
import { SubjectsController } from './subjects.controller';
import { Subject, SubjectSchema } from './schemas/subject.schema';
import { TopicsModule } from '../topics/topics.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
    TopicsModule, // Import to access Topic model
  ],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [
    SubjectsService,
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
  ],
})
export class SubjectsModule {}
