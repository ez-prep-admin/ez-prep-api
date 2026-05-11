import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { CategoriesModule } from '../categories/categories.module';
import { ExamsModule } from '../exams/exams.module';

@Module({
  imports: [
    CategoriesModule, // Provides Category model
    ExamsModule, // Provides Exam model (with Category + ExamGroup for populate)
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
