import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  SearchCategoryResultDto,
  SearchExamResultDto,
  SearchResultsDto,
} from './dto/search-result.dto';

interface PopulatedExamCategory {
  _id: unknown;
  id?: string;
  name: string;
  shortName: string;
}

interface PopulatedExamGroup {
  _id: unknown;
  id?: string;
  name: string;
  shortName?: string;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,

    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
  ) {}

  async search(query: string, limit: number = 10): Promise<SearchResultsDto> {
    const safeLimit = Math.min(Math.max(1, limit), 20);
    const regexPattern = new RegExp(
      query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );

    const categoryQuery: FilterQuery<CategoryDocument> = {
      isActive: true,
      $or: [{ name: regexPattern }, { shortName: regexPattern }],
    };

    const examQuery: FilterQuery<ExamDocument> = {
      isActive: true,
      $or: [{ name: regexPattern }, { description: regexPattern }],
    };

    const [categoryDocs, examDocs] = await Promise.all([
      this.categoryModel
        .find(categoryQuery)
        .select('id name shortName imageUrl description')
        .limit(safeLimit)
        .lean<
          Array<{
            _id: unknown;
            id?: string;
            name: string;
            shortName: string;
            imageUrl?: string;
            description?: string;
          }>
        >()
        .exec(),

      this.examModel
        .find(examQuery)
        .select(
          'id name description category examGroup duration totalQuestions totalMarks',
        )
        .populate('category', 'id name shortName')
        .populate('examGroup', 'id name shortName')
        .limit(safeLimit)
        .lean<
          Array<{
            _id: unknown;
            id?: string;
            name: string;
            description?: string;
            duration?: number;
            totalQuestions?: number;
            totalMarks?: number;
            category: PopulatedExamCategory;
            examGroup: PopulatedExamGroup;
          }>
        >()
        .exec(),
    ]);

    const categories: SearchCategoryResultDto[] = categoryDocs.map(doc => ({
      id: doc.id ?? String(doc._id),
      name: doc.name,
      shortName: doc.shortName,
      imageUrl: doc.imageUrl,
      description: doc.description,
    }));

    const exams: SearchExamResultDto[] = examDocs.map(doc => ({
      id: doc.id ?? String(doc._id),
      name: doc.name,
      description: doc.description,
      category: {
        id: doc.category?.id ?? String(doc.category?._id),
        name: doc.category?.name,
        shortName: doc.category?.shortName,
      },
      examGroup: {
        id: doc.examGroup?.id ?? String(doc.examGroup?._id),
        name: doc.examGroup?.name,
        shortName: doc.examGroup?.shortName,
      },
      duration: doc.duration,
      totalQuestions: doc.totalQuestions,
      totalMarks: doc.totalMarks,
    }));

    return { categories, exams };
  }
}
