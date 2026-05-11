import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamGroupsService } from './exam-groups.service';
import { ExamGroupsController } from './exam-groups.controller';
import { ExamGroup, ExamGroupSchema } from './schemas/exam-group.schema';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExamGroup.name, schema: ExamGroupSchema },
    ]),
    CategoriesModule, // Import to access Category model for populate
  ],
  controllers: [ExamGroupsController],
  providers: [ExamGroupsService],
  exports: [
    ExamGroupsService,
    MongooseModule.forFeature([
      { name: ExamGroup.name, schema: ExamGroupSchema },
    ]),
  ],
})
export class ExamGroupsModule {}
