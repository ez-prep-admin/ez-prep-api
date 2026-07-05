import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { Topic, TopicSchema } from './schemas/topic.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Topic.name, schema: TopicSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [
    TopicsService,
    MongooseModule.forFeature([{ name: Topic.name, schema: TopicSchema }]),
  ],
})
export class TopicsModule {}
