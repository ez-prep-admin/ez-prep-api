import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { MockTest, MockTestDocument } from './schemas/mock-test.schema';
import { Topic, TopicDocument } from '../topics/schemas/topic.schema';
import {
  Question,
  QuestionDocument,
} from '../mock-test-attempts/schemas/question.schema';
import { CreateTopicWiseMockTestDto } from './dto/create-topic-wise-mock-test.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserRole } from '../common/enums/user-role.enum';
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
import { PaperType } from '../common/enums/paper-type.enum';

const TOPIC_WISE_FILTER: FilterQuery<MockTestDocument> = {
  paperType: { $ne: PaperType.FULL_EXAM },
  isDeleted: { $ne: true },
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

@Injectable()
export class MockTestsService {
  constructor(
    @InjectModel(MockTest.name) private mockTestModel: Model<MockTestDocument>,
    @InjectModel(MockTestAttempt.name)
    private attemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(Topic.name) private topicModel: Model<TopicDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
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
    isAdmin = false,
  ): Promise<PaginatedMockTestsResponseDto> {
    // Validate and normalize pagination parameters
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
    const skip = (validPage - 1) * validLimit;

    // Build query — never leak full-exam papers into topic-wise lists
    const query: FilterQuery<MockTestDocument> = {
      ...TOPIC_WISE_FILTER,
      ...(isAdmin ? {} : { isActive: true }),
    };

    // Add search filter if search term is provided
    if (search && search.trim()) {
      const term = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    // Execute queries in parallel for better performance
    const findQuery = this.mockTestModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit);

    if (!isAdmin) {
      findQuery.select('-questionIds');
    }

    if (isAdmin) {
      findQuery
        .populate('exam', 'name description')
        .populate('subject', 'name description')
        .populate('topic', 'name');
    }

    const [mockTests, total] = await Promise.all([
      findQuery.exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate user attempt actions if userId provided
    let userActions = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();
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
        const entry = userActions.get(testId) || {
          action: UserAttemptAction.START,
        };
        return isAdmin
          ? (this.toListItemDto(
              test,
              entry.action,
              entry.resumeAttemptId,
            ) as unknown as MockTestResponseDto)
          : this.toResponseDto(test, entry.action, entry.resumeAttemptId);
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
  async findOne(
    id: string,
    user?: UserResponseDto,
  ): Promise<MockTestResponseDto> {
    const isAdmin = user?.role === UserRole.ADMIN;
    let query = this.mockTestModel.findOne({
      _id: id,
      ...TOPIC_WISE_FILTER,
      ...(isAdmin ? {} : { isActive: true }),
    });

    if (isAdmin) {
      query = query
        .populate('exam', 'name')
        .populate('subject', 'name')
        .populate('topic', 'name')
        .populate({
          path: 'questionIds',
          select: 'questionText subject',
          populate: { path: 'subject', select: 'name' },
        });
    } else {
      query = query.select('-questionIds');
    }

    const mockTest = await query.exec();

    if (!mockTest) {
      throw new NotFoundException(`Mock test with ID "${id}" not found`);
    }

    if (isAdmin) {
      return this.toAdminDetailDto(mockTest);
    }

    return this.toResponseDto(mockTest);
  }

  async createTopicWise(
    dto: CreateTopicWiseMockTestDto,
    userId: string,
  ): Promise<MockTestResponseDto> {
    this.assertDifficultySum(dto);
    const questionIds = await this.sampleQuestionIds(dto);

    const mockTest = await this.mockTestModel.create({
      paperType: PaperType.TOPIC_WISE,
      totalQuestions: dto.totalQuestions,
      durationInMinutes: dto.durationInMinutes,
      exam: new Types.ObjectId(dto.exam),
      subject: new Types.ObjectId(dto.subject),
      topic: dto.topic ? new Types.ObjectId(dto.topic) : null,
      difficultyDistribution: dto.difficultyDistribution,
      title: dto.title || null,
      description: dto.description || null,
      generationMode: dto.generationMode || 'STATIC',
      questionIds,
      marksPerQuestion: dto.marksPerQuestion ?? 1,
      negativeMarking: dto.negativeMarking ?? 0,
      passingScore: dto.passingScore ?? null,
      allowRetake: dto.allowRetake ?? true,
      shuffleOptions: dto.shuffleOptions ?? false,
      showResultsImmediately: dto.showResultsImmediately ?? true,
      createdBy: new Types.ObjectId(userId),
      isActive: true,
      isDeleted: false,
    });

    return this.findOne(mockTest.id, {
      id: userId,
      role: UserRole.ADMIN,
    } as UserResponseDto);
  }

  async updateTopicWise(
    id: string,
    dto: CreateTopicWiseMockTestDto,
    userId: string,
  ): Promise<MockTestResponseDto> {
    const existing = await this.mockTestModel
      .findOne({ _id: id, ...TOPIC_WISE_FILTER })
      .exec();

    if (!existing) {
      throw new NotFoundException(`Mock test with ID "${id}" not found`);
    }

    this.assertDifficultySum(dto);
    const shouldResample = this.shouldResampleTopicWise(existing, dto);
    const questionIds = shouldResample
      ? await this.sampleQuestionIds(dto)
      : existing.questionIds;

    await this.mockTestModel
      .findOneAndUpdate(
        { _id: id, ...TOPIC_WISE_FILTER },
        {
          $set: {
            paperType: PaperType.TOPIC_WISE,
            totalQuestions: dto.totalQuestions,
            durationInMinutes: dto.durationInMinutes,
            exam: new Types.ObjectId(dto.exam),
            subject: new Types.ObjectId(dto.subject),
            topic: dto.topic ? new Types.ObjectId(dto.topic) : null,
            difficultyDistribution: dto.difficultyDistribution,
            title: dto.title,
            description: dto.description,
            generationMode: dto.generationMode || existing.generationMode,
            questionIds,
            marksPerQuestion: dto.marksPerQuestion ?? existing.marksPerQuestion,
            negativeMarking: dto.negativeMarking ?? existing.negativeMarking,
            passingScore: dto.passingScore,
            allowRetake: dto.allowRetake,
            shuffleOptions: dto.shuffleOptions,
            showResultsImmediately: dto.showResultsImmediately,
          },
        },
        { new: true },
      )
      .exec();

    return this.findOne(id, {
      id: userId,
      role: UserRole.ADMIN,
    } as UserResponseDto);
  }

  async removeTopicWise(id: string): Promise<{ message: string }> {
    const mockTest = await this.mockTestModel
      .findOneAndUpdate(
        { _id: id, ...TOPIC_WISE_FILTER },
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .exec();

    if (!mockTest) {
      throw new NotFoundException(`Mock test with ID "${id}" not found`);
    }

    return { message: 'Mock test deleted successfully' };
  }

  private assertDifficultySum(dto: CreateTopicWiseMockTestDto) {
    const { easy, medium, hard } = dto.difficultyDistribution;
    const sum = easy + medium + hard;
    if (sum !== dto.totalQuestions) {
      throw new BadRequestException(
        `Difficulty distribution sum (${sum}) must equal total questions (${dto.totalQuestions})`,
      );
    }
  }

  private shouldResampleTopicWise(
    existing: MockTestDocument,
    dto: CreateTopicWiseMockTestDto,
  ): boolean {
    const existingTopic = existing.topic?.toString() || '';
    const nextTopic = dto.topic || '';
    const existingDist = existing.difficultyDistribution || {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    return (
      !existing.questionIds?.length ||
      existing.totalQuestions !== dto.totalQuestions ||
      existing.exam?.toString() !== dto.exam ||
      existing.subject?.toString() !== dto.subject ||
      existingTopic !== nextTopic ||
      existingDist.easy !== dto.difficultyDistribution.easy ||
      existingDist.medium !== dto.difficultyDistribution.medium ||
      existingDist.hard !== dto.difficultyDistribution.hard
    );
  }

  private async sampleQuestionIds(
    dto: CreateTopicWiseMockTestDto,
  ): Promise<Types.ObjectId[]> {
    const baseMatch: Record<string, unknown> = {
      subject: new Types.ObjectId(dto.subject),
      exams: new Types.ObjectId(dto.exam),
      isActive: true,
      isDeleted: { $ne: true },
    };
    if (dto.topic) {
      baseMatch.topic = new Types.ObjectId(dto.topic);
    }

    const levels = (['easy', 'medium', 'hard'] as const).filter(
      level => dto.difficultyDistribution[level] > 0,
    );

    const sampledGroups = await Promise.all(
      levels.map(async level => {
        const count = dto.difficultyDistribution[level];
        const questions = await this.questionModel.aggregate([
          { $match: { ...baseMatch, difficultyLevel: level } },
          { $sample: { size: count } },
        ]);

        if (questions.length < count) {
          throw new BadRequestException(
            `Not enough ${level} questions available. Found ${questions.length}, need ${count}`,
          );
        }

        return questions.map(question => question._id as Types.ObjectId);
      }),
    );

    return sampledGroups.flat();
  }

  private toAdminDetailDto(mockTest: MockTestDocument): MockTestResponseDto {
    const examDoc = mockTest.exam as unknown as PopulatedDocument;
    const subjectDoc = mockTest.subject as unknown as PopulatedDocument;
    const topicDoc = mockTest.topic as unknown as PopulatedDocument;
    const questions = (mockTest.questionIds || []).map(question => {
      const q = question as unknown as PopulatedDocument & {
        questionText?: unknown;
        subject?: PopulatedDocument;
        id?: string;
      };
      return {
        id: q.id || q._id?.toString(),
        questionText: q.questionText,
        subject: q.subject
          ? {
              id: q.subject._id?.toString() || q.subject.id,
              name: q.subject.name,
            }
          : null,
      };
    });

    return {
      ...this.toListItemDto(mockTest),
      exam: examDoc
        ? { id: examDoc._id?.toString() || examDoc.id, name: examDoc.name }
        : mockTest.exam?.toString(),
      subject: subjectDoc
        ? {
            id: subjectDoc._id?.toString() || subjectDoc.id,
            name: subjectDoc.name,
          }
        : mockTest.subject?.toString(),
      topic: topicDoc
        ? { id: topicDoc._id?.toString() || topicDoc.id, name: topicDoc.name }
        : undefined,
      questions,
    } as unknown as MockTestResponseDto;
  }

  /**
   * Get mock test statistics
   * @returns Statistics about mock tests
   */
  async getStats() {
    const [totalTests, activeTests, staticTests, dynamicTests] =
      await Promise.all([
        this.mockTestModel.countDocuments({ ...TOPIC_WISE_FILTER }),
        this.mockTestModel.countDocuments({
          ...TOPIC_WISE_FILTER,
          isActive: true,
        }),
        this.mockTestModel.countDocuments({
          ...TOPIC_WISE_FILTER,
          generationMode: 'STATIC',
        }),
        this.mockTestModel.countDocuments({
          ...TOPIC_WISE_FILTER,
          generationMode: 'DYNAMIC',
        }),
      ]);

    // Aggregate difficulty distribution across all tests
    const difficultyAggregation = await this.mockTestModel
      .aggregate([
        { $match: { ...TOPIC_WISE_FILTER, isDeleted: { $ne: true } } },
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
      ...TOPIC_WISE_FILTER,
      isActive: true,
      exam: new Types.ObjectId(examId),
    };

    // Filter by subject if provided
    if (subjectId) {
      query.subject = new Types.ObjectId(subjectId);
    }

    // Search by topic name if provided
    if (search && search.trim()) {
      const matchingTopics = await this.topicModel
        .find({ name: { $regex: escapeRegex(search.trim()), $options: 'i' } })
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
        .select('-questionIds')
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
    let userActions = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const entry = userActions.get(testId) || {
          action: UserAttemptAction.START,
        };
        return this.toListItemDto(test, entry.action, entry.resumeAttemptId);
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

    const query: FilterQuery<MockTestDocument> = {
      ...TOPIC_WISE_FILTER,
      isActive: true,
      subject: new Types.ObjectId(subjectId),
    };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .select('-questionIds')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate user attempt actions if userId provided
    let userActions = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const entry = userActions.get(testId) || {
          action: UserAttemptAction.START,
        };
        return this.toResponseDto(test, entry.action, entry.resumeAttemptId);
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

    const query: FilterQuery<MockTestDocument> = {
      ...TOPIC_WISE_FILTER,
      isActive: true,
      exam: new Types.ObjectId(examId),
      subject: new Types.ObjectId(subjectId),
    };

    const [mockTests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .select('-questionIds')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    // Calculate user attempt actions if userId provided
    let userActions = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const entry = userActions.get(testId) || {
          action: UserAttemptAction.START,
        };
        return this.toResponseDto(test, entry.action, entry.resumeAttemptId);
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

    const query: FilterQuery<MockTestDocument> = {
      ...TOPIC_WISE_FILTER,
      isActive: true,
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
    let userActions = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();
    if (userId) {
      const testIds = mockTests.map(test => test._id.toString());
      userActions = await this.calculateUserAttemptActions(testIds, userId);
    }

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: mockTests.map(test => {
        const testId = test._id.toString();
        const entry = userActions.get(testId) || {
          action: UserAttemptAction.START,
        };
        return this.toResponseDto(test, entry.action, entry.resumeAttemptId);
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
   * Public wrapper used by full-mock lists (same START / RESUME / RETAKE rules).
   */
  async getUserAttemptActions(
    mockTestIds: string[],
    userId: string,
  ): Promise<
    Map<string, { action: UserAttemptAction; resumeAttemptId?: string }>
  > {
    return this.calculateUserAttemptActions(mockTestIds, userId);
  }

  /**
   * Calculate user attempt action for multiple mock tests efficiently
   * Determines whether user should START, RESUME, or RETAKE each test.
   * For RESUME, also returns the ID of the latest active attempt.
   * @param mockTestIds - Array of mock test IDs to check
   * @param userId - User ID to check attempts for
   * @returns Map of mock test ID to { action, resumeAttemptId? }
   */
  private async calculateUserAttemptActions(
    mockTestIds: string[],
    userId: string,
  ): Promise<
    Map<string, { action: UserAttemptAction; resumeAttemptId?: string }>
  > {
    const actionMap = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();

    if (!mockTestIds.length || !userId) {
      return actionMap;
    }

    // Query all relevant attempts sorted newest-first so we can pick the latest active one
    const attempts = await this.attemptModel
      .find({
        user: new Types.ObjectId(userId),
        mockTest: { $in: mockTestIds.map(id => new Types.ObjectId(id)) },
      })
      .select('mockTest status createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Group attempts by test ID (order preserved — newest first)
    const attemptsByTest = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const testId = attempt.mockTest.toString();
      if (!attemptsByTest.has(testId)) {
        attemptsByTest.set(testId, []);
      }
      attemptsByTest.get(testId)!.push(attempt);
    }

    // Determine action for each test
    for (const testId of mockTestIds) {
      const testAttempts = attemptsByTest.get(testId) || [];

      if (testAttempts.length === 0) {
        actionMap.set(testId, { action: UserAttemptAction.START });
        continue;
      }

      // Find the latest attempt that is still active (IN_PROGRESS or PAUSED)
      const activeAttempt = testAttempts.find(
        attempt =>
          attempt.status === 'PAUSED' || attempt.status === 'IN_PROGRESS',
      );

      if (activeAttempt) {
        actionMap.set(testId, {
          action: UserAttemptAction.RESUME,
          resumeAttemptId: (activeAttempt._id as Types.ObjectId).toString(),
        });
        continue;
      }

      const hasCompletedAttempt = testAttempts.some(
        attempt =>
          attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED',
      );

      if (hasCompletedAttempt) {
        actionMap.set(testId, { action: UserAttemptAction.RETAKE });
      } else {
        actionMap.set(testId, { action: UserAttemptAction.START });
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
    resumeAttemptId?: string,
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
      resumeAttemptId,
    });
  }

  /**
   * Helper method to convert MockTest document to list item DTO
   * Includes populated exam, subject, and topic details
   */
  private toListItemDto(
    mockTest: MockTestDocument,
    userAttemptAction?: UserAttemptAction,
    resumeAttemptId?: string,
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
      resumeAttemptId,
    });
  }
}
