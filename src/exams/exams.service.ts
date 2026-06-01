import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Exam, ExamDocument } from './schemas/exam.schema';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamResponseDto } from './dto/exam-response.dto';
import { ExamsByCategoryResponseDto } from './dto/exams-by-category-response.dto';
import { PaginatedExamsResponseDto } from './dto/paginated-exams-response.dto';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Exam.name)
    private examModel: Model<ExamDocument>,
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
  ) {}

  /**
   * Create a new exam
   */
  async create(createExamDto: CreateExamDto): Promise<ExamResponseDto> {
    // Verify category exists
    const category = await this.categoryModel
      .findById(createExamDto.category)
      .exec();

    if (!category) {
      throw new BadRequestException(
        `Category with ID "${createExamDto.category}" not found`,
      );
    }

    // Check for duplicate name within same category
    const existing = await this.examModel
      .findOne({
        name: createExamDto.name,
        category: createExamDto.category,
      })
      .exec();

    if (existing) {
      throw new ConflictException(
        'Exam with this name already exists in this category',
      );
    }

    const exam = await this.examModel.create(createExamDto);
    return this.toResponseDto(exam);
  }

  /**
   * Find all exams with pagination and search
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoryId?: string,
    activeOnly: boolean = true,
  ): Promise<PaginatedExamsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<Exam> = {
      isDeleted: false,
    };

    if (activeOnly) {
      query.isActive = true;
    }

    if (categoryId) {
      query.category = new Types.ObjectId(categoryId);
    }

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    const [exams, total] = await Promise.all([
      this.examModel
        .find(query)
        .populate('examGroup', 'name shortName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.examModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: exams.map(exam => this.toResponseDto(exam)),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  }

  /**
   * Get exams grouped by category (PUBLIC API)
   * Returns all active categories and their exams
   */
  async getExamsByCategory(): Promise<ExamsByCategoryResponseDto> {
    const categoryQuery: FilterQuery<Category> = { isActive: true };
    const examQuery: FilterQuery<Exam> = { isActive: true };

    // Get all active categories
    const categories = await this.categoryModel
      .find(categoryQuery)
      .sort({ name: 1 })
      .lean()
      .exec();

    // Get all active exams
    const exams = await this.examModel.find(examQuery).lean().exec();

    // Get mock test counts per exam (from mocktests collection)
    const mockTestCounts = await this.examModel
      .aggregate([
        {
          $lookup: {
            from: 'mocktests',
            let: { examId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$exam', '$$examId'] },
                  isActive: true,
                  isDeleted: false,
                },
              },
              { $count: 'count' },
            ],
            as: 'mockTests',
          },
        },
        {
          $project: {
            _id: 1,
            testsCount: {
              $ifNull: [{ $arrayElemAt: ['$mockTests.count', 0] }, 0],
            },
          },
        },
      ])
      .exec();

    const testCountMap = new Map(
      mockTestCounts.map(item => [item._id.toString(), item.testsCount]),
    );

    // Group exams by category and return as array
    const result: ExamsByCategoryResponseDto = [];

    for (const category of categories) {
      const categoryExams = exams.filter(
        exam =>
          exam.category && exam.category.toString() === category._id.toString(),
      );

      // Include category even if it has no exams
      result.push({
        id: category._id.toString(),
        name: category.name,
        shortName: category.shortName,
        imageUrl: category.imageUrl,
        description: category.description,
        exams: categoryExams.map(exam => ({
          id: exam._id.toString(),
          title: exam.name,
          fullName: exam.description,
          duration: exam.duration
            ? this.formatDuration(exam.duration)
            : undefined,
          totalQuestions: exam.totalQuestions,
          totalMarks: exam.totalMarks,
          testsCount: testCountMap.get(exam._id.toString()) || 0,
          subjectsCount: exam.subjects?.length || 0,
        })),
      });
    }

    return result;
  }

  /**
   * Find one exam by ID
   */
  async findOne(id: string): Promise<ExamResponseDto> {
    const exam = await this.examModel.findById(id).populate('category').exec();

    if (!exam) {
      throw new NotFoundException(`Exam with ID "${id}" not found`);
    }

    return this.toResponseDto(exam);
  }

  /**
   * Find exams by category
   */
  async findByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedExamsResponseDto> {
    return this.findAll(page, limit, undefined, categoryId, true);
  }

  /**
   * Update exam
   */
  async update(
    id: string,
    updateExamDto: UpdateExamDto,
  ): Promise<ExamResponseDto> {
    // If category is being updated, verify it exists
    if (updateExamDto.category) {
      const category = await this.categoryModel
        .findById(updateExamDto.category)
        .exec();

      if (!category) {
        throw new BadRequestException(
          `Category with ID "${updateExamDto.category}" not found`,
        );
      }
    }

    // Check for duplicate name if name or category is being updated
    if (updateExamDto.name || updateExamDto.category) {
      const existingExam = await this.examModel.findById(id).exec();
      if (!existingExam) {
        throw new NotFoundException(`Exam with ID "${id}" not found`);
      }

      const duplicate = await this.examModel
        .findOne({
          _id: { $ne: id },
          name: updateExamDto.name || existingExam.name,
          category: updateExamDto.category || existingExam.category,
        })
        .exec();

      if (duplicate) {
        throw new ConflictException(
          'Exam with this name already exists in this category',
        );
      }
    }

    const exam = await this.examModel
      .findByIdAndUpdate(id, updateExamDto, { new: true })
      .populate('category')
      .exec();

    if (!exam) {
      throw new NotFoundException(`Exam with ID "${id}" not found`);
    }

    return this.toResponseDto(exam);
  }

  /**
   * Soft delete exam
   */
  async remove(id: string): Promise<ExamResponseDto> {
    const exam = await this.examModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .populate('category')
      .exec();

    if (!exam) {
      throw new NotFoundException(`Exam with ID "${id}" not found`);
    }

    return this.toResponseDto(exam);
  }

  /**
   * Helper: Format duration from minutes to human-readable string
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  /**
   * Helper to convert document to DTO
   */
  private toResponseDto(exam: ExamDocument): ExamResponseDto {
    const obj = exam.toObject({ transform: false, virtuals: false });

    return new ExamResponseDto({
      ...obj,
      _id: obj._id,
      examGroup: this.toPopulatedExamGroup(obj.examGroup),
      subjects: obj.subjects?.map(s => ({
        ...s,
        subject: s.subject,
      })),
    });
  }

  private toPopulatedExamGroup(
    ref: unknown,
  ): Types.ObjectId | string | { _id: Types.ObjectId; name: string; shortName?: string } {
    if (!ref) {
      return '';
    }
    if (ref instanceof Types.ObjectId || typeof ref === 'string') {
      return ref;
    }
    const group = ref as {
      _id: Types.ObjectId;
      name: string;
      shortName?: string;
    };
    return {
      _id: group._id,
      name: group.name,
      shortName: group.shortName,
    };
  }
}
