import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MockTest, MockTestDocument } from './schemas/mock-test.schema';
import { MockTestResponseDto } from './dto/mock-test-response.dto';

export interface PaginatedMockTestsResponse {
  data: MockTestResponseDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class MockTestsService {
  constructor(
    @InjectModel(MockTest.name) private mockTestModel: Model<MockTestDocument>,
  ) {}

  /**
   * Find all mock tests with pagination and search
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @param search - Search term for title (optional)
   * @returns Paginated mock tests with metadata
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<PaginatedMockTestsResponse> {
    // Validate and normalize pagination parameters
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
    const skip = (validPage - 1) * validLimit;

    // Build query
    const query: any = {};

    // Add search filter if search term is provided
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } }, // Case-insensitive regex search
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Execute queries in parallel for better performance
    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    return {
      data: mockTests.map(test => this.toResponseDto(test)),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  }

  /**
   * Find a single mock test by ID
   * @param id - Mock test ID
   * @returns Mock test details
   * @throws NotFoundException if mock test not found
   */
  async findOne(id: string): Promise<MockTestResponseDto> {
    const mockTest = await this.mockTestModel.findById(id).exec();

    if (!mockTest) {
      throw new NotFoundException(`Mock test with ID "${id}" not found`);
    }

    return this.toResponseDto(mockTest);
  }

  /**
   * Get mock test statistics
   * @returns Statistics about mock tests
   */
  async getStats() {
    const [totalTests, activeTests, staticTests, dynamicTests] =
      await Promise.all([
        this.mockTestModel.countDocuments({}),
        this.mockTestModel.countDocuments({ isActive: true }),
        this.mockTestModel.countDocuments({ generationMode: 'STATIC' }),
        this.mockTestModel.countDocuments({ generationMode: 'DYNAMIC' }),
      ]);

    // Aggregate difficulty distribution across all tests
    const difficultyAggregation = await this.mockTestModel
      .aggregate([
        {
          $group: {
            _id: null,
            totalEasy: { $sum: '$difficultyDistribution.easy' },
            totalMedium: { $sum: '$difficultyDistribution.medium' },
            totalHard: { $sum: '$difficultyDistribution.hard' },
          },
        },
      ])
      .exec();

    const difficultyStats = difficultyAggregation[0] || {
      totalEasy: 0,
      totalMedium: 0,
      totalHard: 0,
    };

    return {
      totalTests,
      activeTests,
      inactiveTests: totalTests - activeTests,
      byGenerationMode: {
        static: staticTests,
        dynamic: dynamicTests,
      },
      totalQuestionsByDifficulty: {
        easy: difficultyStats.totalEasy,
        medium: difficultyStats.totalMedium,
        hard: difficultyStats.totalHard,
      },
    };
  }

  /**
   * Find mock tests by exam
   * @param examId - Exam ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated mock tests
   */
  async findByExam(
    examId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMockTestsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query = { exam: examId };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => this.toResponseDto(test)),
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
   * Find mock tests by subject
   * @param subjectId - Subject ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated mock tests
   */
  async findBySubject(
    subjectId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMockTestsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query = { subject: subjectId };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => this.toResponseDto(test)),
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
   * Find mock tests by exam and subject
   * @param examId - Exam ID
   * @param subjectId - Subject ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated mock tests
   */
  async findByExamAndSubject(
    examId: string,
    subjectId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMockTestsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query = { exam: examId, subject: subjectId };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => this.toResponseDto(test)),
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
   * Find active mock tests only
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated active mock tests
   */
  async findActive(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMockTestsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query = { isActive: true };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => this.toResponseDto(test)),
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
   * Helper method to convert MockTest document to DTO
   * Transforms ObjectIds to strings for proper serialization
   */
  private toResponseDto(mockTest: MockTestDocument): MockTestResponseDto {
    const obj = mockTest.toObject();
    return new MockTestResponseDto({
      ...obj,
      exam: obj.exam?.toString(),
      subject: obj.subject?.toString(),
      topic: obj.topic?.toString(),
      questionIds: obj.questionIds?.map(id => id.toString()) || [],
      createdBy: obj.createdBy?.toString(),
      difficultyDistribution: obj.difficultyDistribution || {
        easy: 0,
        medium: 0,
        hard: 0,
      },
    });
  }
}
