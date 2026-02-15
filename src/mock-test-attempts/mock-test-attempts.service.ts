import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from './schemas/mock-test-attempt.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { StartAttemptResponseDto } from './dto/start-attempt-response.dto';

@Injectable()
export class MockTestAttemptsService {
  constructor(
    @InjectModel(MockTestAttempt.name)
    private attemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(MockTest.name)
    private mockTestModel: Model<MockTestDocument>,
    @InjectModel(Question.name)
    private questionModel: Model<QuestionDocument>,
  ) {}

  /**
   * Start a new mock test attempt
   * @param startAttemptDto - Contains mockTestId
   * @param userId - ID of the authenticated user
   * @returns Attempt details with safe questions (no answers)
   */
  async startAttempt(
    startAttemptDto: StartAttemptDto,
    userId: string,
  ): Promise<StartAttemptResponseDto> {
    const { mockTestId } = startAttemptDto;

    // Step 1: Validate mock test ID format
    if (!Types.ObjectId.isValid(mockTestId)) {
      throw new BadRequestException('Invalid mock test ID format');
    }

    // Step 2: Fetch the mock test
    const test = await this.mockTestModel.findById(mockTestId).exec();

    if (!test) {
      throw new NotFoundException(
        `Mock test with ID "${mockTestId}" not found`,
      );
    }

    if (!test.isActive) {
      throw new BadRequestException(
        'This mock test is currently not available',
      );
    }

    // Step 3: Check if retakes are allowed
    if (!test.allowRetake) {
      const existingAttempt = await this.attemptModel
        .findOne({
          user: new Types.ObjectId(userId),
          test: new Types.ObjectId(mockTestId),
          status: { $in: ['SUBMITTED', 'IN_PROGRESS'] },
        })
        .exec();

      if (existingAttempt) {
        throw new ConflictException(
          'You have already attempted this test. Retakes are not allowed.',
        );
      }
    }

    // Step 4: Check for existing IN_PROGRESS attempt
    const inProgressAttempt = await this.attemptModel
      .findOne({
        user: new Types.ObjectId(userId),
        test: new Types.ObjectId(mockTestId),
        status: 'IN_PROGRESS',
      })
      .exec();

    if (inProgressAttempt) {
      throw new ConflictException(
        'You already have an in-progress attempt for this test. Please complete or submit it first.',
      );
    }

    // Step 5: Create the attempt with frozen configuration
    const attempt = await this.attemptModel.create({
      user: new Types.ObjectId(userId),
      test: test._id,
      totalQuestions: test.totalQuestions,
      durationInMinutes: test.durationInMinutes,
      marksPerQuestion: test.marksPerQuestion,
      negativeMarking: test.negativeMarking,
      passingScore: test.passingScore,
      shuffleOptions: test.shuffleOptions,
      showResultsImmediately: test.showResultsImmediately,
      questions: test.questionIds.map(q => ({
        question: q,
        selectedOption: null,
        isCorrect: null,
        marksAwarded: 0,
      })),
      startedAt: new Date(),
      status: 'IN_PROGRESS',
    });

    // Step 6: Fetch questions without correct answers or explanations
    const questions = await this.questionModel
      .find({
        _id: { $in: test.questionIds },
      })
      .select('-correctAnswer -explanation')
      .lean()
      .exec();

    // Step 7: Format response
    const response: StartAttemptResponseDto = {
      attemptId: attempt.id,
      test: {
        title: test.title,
        durationInMinutes: test.durationInMinutes,
        totalQuestions: test.totalQuestions,
        startedAt: attempt.startedAt,
        marksPerQuestion: test.marksPerQuestion,
        negativeMarking: test.negativeMarking,
        passingScore: test.passingScore,
      },
      questions: questions.map(q => ({
        _id: q._id.toString(),
        questionText: q.questionText,
        image: q.image,
        options:
          q.options?.map(opt => ({
            id: opt.id,
            type: opt.type,
            en: opt.en,
            ml: opt.ml,
            url: opt.url,
            _id: opt._id?.toString(),
          })) || [],
        subject: q.subject?.toString(),
        difficulty: q.difficulty,
      })),
    };

    return response;
  }

  /**
   * Get attempt by ID (for authenticated user)
   * @param attemptId - Attempt ID
   * @param userId - User ID
   * @returns Attempt details
   */
  async findOne(attemptId: string, userId: string) {
    if (!Types.ObjectId.isValid(attemptId)) {
      throw new BadRequestException('Invalid attempt ID format');
    }

    const attempt = await this.attemptModel
      .findOne({
        _id: attemptId,
        user: new Types.ObjectId(userId),
      })
      .exec();

    if (!attempt) {
      throw new NotFoundException(
        `Attempt with ID "${attemptId}" not found or you don't have access to it`,
      );
    }

    return attempt;
  }

  /**
   * Get all attempts for a user
   * @param userId - User ID
   * @returns User's attempts
   */
  async findUserAttempts(userId: string) {
    const attempts = await this.attemptModel
      .find({ user: new Types.ObjectId(userId) })
      .populate('test', 'title totalQuestions durationInMinutes')
      .sort({ createdAt: -1 })
      .exec();

    return attempts;
  }

  /**
   * Get user's attempts for a specific test
   * @param userId - User ID
   * @param mockTestId - Mock test ID
   * @returns User's attempts for the test
   */
  async findUserTestAttempts(userId: string, mockTestId: string) {
    if (!Types.ObjectId.isValid(mockTestId)) {
      throw new BadRequestException('Invalid mock test ID format');
    }

    const attempts = await this.attemptModel
      .find({
        user: new Types.ObjectId(userId),
        test: new Types.ObjectId(mockTestId),
      })
      .sort({ createdAt: -1 })
      .exec();

    return attempts;
  }
}
