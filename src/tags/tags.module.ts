import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { Tag, TagSchema } from './schemas/tag.schema';
import { SubjectsModule } from '../subjects/subjects.module';
import { TopicsModule } from '../topics/topics.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tag.name, schema: TagSchema }]),
    SubjectsModule,
    TopicsModule,
  ],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService, MongooseModule],
})
export class TagsModule {}
