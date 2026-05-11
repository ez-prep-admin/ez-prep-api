import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { MockTest, MockTestDocument } from './schemas/mock-test.schema';
import { Topic, TopicDocument } from '../topics/schemas/topic.schema';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { MockTestResponseDto } from './dto/mock-test-response.dto';
import { MockTestListItemDto } from './dto/mock-test-list-item.dto';
import {
  PaginatedMockTestsResponseDto,
  PaginatedMockTestListResponseDto,
} from './dto/paginated-mock-tests-response.dto';
import { PopulatedDocument } from '../common/types/populated-document.interface';
import { UserAttemptAction } from '../common/enums/user-attempt-action.enum';

@Injectable()
export class MockTestsService {
  constructor(
    @InjectModel(MockTest.name) private mockTestModel: Model<MockTestDocument>,
    @InjectModel(MockTestAttempt.name)
    private attemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(Topic.name) private topicModel: Model<TopicDocument>,
  ) {}

  /**
   * Find all mock tests with pagination and search
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @param search - Search term for title (optional)
   * @param userId - User ID to calculate attempt actions (optional)
   * @returns Paginated mock tests with metadata
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    userId?: string,
  ): Promise<PaginatedMockTestsResponseDto> {
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

    // Calculate user attempt actions if userId provided
    let userActions = new Map<string, UserAttemptAction>();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const action = userActions.get(testId) || UserAttemptAction.START;
        return this.toResponseDto(test, action);
      }),
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
   * Find mock tests by exam with optional topic search and subject filter
   * @param examId - Exam ID
   * @param page - Page number
   * @param limit - Items per page
   * @param userId - User ID to calculate attempt actions (optional)
   * @param search - Search term for topic name (optional)
   * @param subjectId - Subject ID to filter by (optional)
   * @returns Paginated mock tests with populated references
   */
  async findByExam(
    examId: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
    search?: string,
    subjectId?: string,
  ): Promise<PaginatedMockTestListResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<MockTestDocument> = {
      exam: new Types.ObjectId(examId),
    };

    // Filter by subject if provided
    if (subjectId) {
      query.subject = new Types.ObjectId(subjectId);
    }

    // Search by topic name if provided
    if (search && search.trim()) {
      const matchingTopics = await this.topicModel
        .find({ name: { $regex: search.trim(), $options: 'i' } })
        .select('_id')
        .lean()
        .exec();
      // If no topics match, return empty result immediately
      if (matchingTopics.length === 0) {
        return {
          data: [],
          pagination: {
            total: 0,
            page: validPage,
            limit: validLimit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
      query.topic = { $in: matchingTopics.map(t => t._id) };
    }

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .populate('exam', '_id name description')
        .populate('subject', '_id name description')
        .populate('topic', '_id name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate user attempt actions if userId provided
    let userActions = new Map<string, UserAttemptAction>();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const action = userActions.get(testId) || UserAttemptAction.START;
        return this.toListItemDto(test, action);
      }),
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
   * @param userId - User ID to calculate attempt actions (optional)
   * @returns Paginated mock tests
   */
  async findBySubject(
    subjectId: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<PaginatedMockTestsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query = { subject: new Types.ObjectId(subjectId) };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate user attempt actions if userId provided
    let userActions = new Map<string, UserAttemptAction>();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const action = userActions.get(testId) || UserAttemptAction.START;
        return this.toResponseDto(test, action);
      }),
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
   * @param userId - User ID to calculate attempt actions (optional)
   * @returns Paginated mock tests
   */
  async findByExamAndSubject(
    examId: string,
    subjectId: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<PaginatedMockTestsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query = {
      exam: new Types.ObjectId(examId),
      subject: new Types.ObjectId(subjectId),
    };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate user attempt actions if userId provided
    let userActions = new Map<string, UserAttemptAction>();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const action = userActions.get(testId) || UserAttemptAction.START;
        return this.toResponseDto(test, action);
      }),
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
   * @param userId - User ID to calculate attempt actions (optional)
   * @returns Paginated active mock tests
   */
  async findActive(
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<PaginatedMockTestsResponseDto> {
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

    // Calculate user attempt actions if userId provided
    let userActions = new Map<string, UserAttemptAction>();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const action = userActions.get(testId) || UserAttemptAction.START;
        return this.toResponseDto(test, action);
      }),
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
   * Calculate user attempt action for multiple mock tests efficiently
   * Determines whether user should START, RESUME, or RETAKE each test
   * @param mockTestIds - Array of mock test IDs to check
   * @param userId - User ID to check attempts for
   * @returns Map of mock test ID to UserAttemptAction
   */
  private async calculateUserAttemptActions(
    mockTestIds: string[],
    userId: string,
  ): Promise<Map<string, UserAttemptAction>> {
    const actionMap = new Map<string, UserAttemptAction>();

    if (!mockTestIds.length || !userId) {
      return actionMap;
    }

    // Query all relevant attempts for the user and these tests in one go
    const attempts = await this.attemptModel
      .find({
        user: new Types.ObjectId(userId),
        test: { $in: mockTestIds.map(id => new Types.ObjectId(id)) },
      })
      .select('test status')
      .lean()
      .exec();

    // Group attempts by test ID
    const attemptsByTest = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const testId = attempt.test.toString();
      if (!attemptsByTest.has(testId)) {
        attemptsByTest.set(testId, []);
      }
      attemptsByTest.get(testId)!.push(attempt);
    }

    // Determine action for each test
    for (const testId of mockTestIds) {
      const testAttempts = attemptsByTest.get(testId) || [];

      if (testAttempts.length === 0) {
        // No attempts - user should START
        actionMap.set(testId, UserAttemptAction.START);
        continue;
      }

      // Check for paused or in-progress attempts
      const hasActiveAttempt = testAttempts.some(
        attempt =>
          attempt.status === 'PAUSED' || attempt.status === 'IN_PROGRESS',
      );

      if (hasActiveAttempt) {
        // Has paused or in-progress attempt - user should RESUME
        actionMap.set(testId, UserAttemptAction.RESUME);
        continue;
      }

      // Check for completed attempts
      const hasCompletedAttempt = testAttempts.some(
        attempt =>
          attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED',
      );

      if (hasCompletedAttempt) {
        // Has completed attempt - user should RETAKE
        actionMap.set(testId, UserAttemptAction.RETAKE);
      } else {
        // No relevant attempts - user should START
        actionMap.set(testId, UserAttemptAction.START);
      }
    }

    return actionMap;
  }

  /**
   * Helper method to convert MockTest document to DTO
   * Transforms ObjectIds to strings for proper serialization
   */
  private toResponseDto(
    mockTest: MockTestDocument,
    userAttemptAction?: UserAttemptAction,
  ): MockTestResponseDto {
    const obj = mockTest.toObject();
    return new MockTestResponseDto({
      id: obj.id,
      totalQuestions: obj.totalQuestions,
      durationInMinutes: obj.durationInMinutes,
      exam: obj.exam?.toString(),
      subject: obj.subject?.toString(),
      topic: obj.topic?.toString(),
      title: obj.title,
      description: obj.description,
      generationMode: obj.generationMode,
      marksPerQuestion: obj.marksPerQuestion,
      negativeMarking: obj.negativeMarking,
      passingScore: obj.passingScore,
      allowRetake: obj.allowRetake,
      shuffleOptions: obj.shuffleOptions,
      showResultsImmediately: obj.showResultsImmediately,
      isActive: obj.isActive,
      createdBy: obj.createdBy?.toString(),
      difficultyDistribution: obj.difficultyDistribution || {
        easy: 0,
        medium: 0,
        hard: 0,
      },
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
      userAttemptAction: userAttemptAction || UserAttemptAction.START,
    });
  }

  /**
   * Helper method to convert MockTest document to list item DTO
   * Includes populated exam, subject, and topic details
   */
  private toListItemDto(
    mockTest: MockTestDocument,
    userAttemptAction?: UserAttemptAction,
  ): MockTestListItemDto {
    // Access _id and other fields before calling toObject() since toObject transforms delete _id
    const mockTestId = mockTest._id?.toString();

    const examId = mockTest.exam?._id?.toString();
    const examDoc = mockTest.exam as unknown as PopulatedDocument;

    const subjectId = mockTest.subject?._id?.toString();
    const subjectDoc = mockTest.subject as unknown as PopulatedDocument;

    const topicId = mockTest.topic?._id?.toString();
    const topicDoc = mockTest.topic as unknown as PopulatedDocument;

    const obj = mockTest.toObject();

    return new MockTestListItemDto({
      id: mockTestId,
      title: obj.title,
      description: obj.description,
      totalQuestions: obj.totalQuestions,
      durationInMinutes: obj.durationInMinutes,
      exam: mockTest.exam
        ? {
            id: examId || '',
            name: examDoc?.name || '',
            description: examDoc?.description,
          }
        : null,
      subject: mockTest.subject
        ? {
            id: subjectId || '',
            name: subjectDoc?.name || '',
            description: subjectDoc?.description,
          }
        : null,
      topic: mockTest.topic
        ? {
            id: topicId || '',
            name: topicDoc?.name || '',
          }
        : undefined,
      generationMode: obj.generationMode,
      marksPerQuestion: obj.marksPerQuestion,
      negativeMarking: obj.negativeMarking,
      passingScore: obj.passingScore,
      allowRetake: obj.allowRetake,
      shuffleOptions: obj.shuffleOptions,
      showResultsImmediately: obj.showResultsImmediately,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
      userAttemptAction: userAttemptAction || UserAttemptAction.START,
    });
  }
}
