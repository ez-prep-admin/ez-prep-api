import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
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
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { AttemptDetailResponseDto } from './dto/attempt-detail-response.dto';
import { ResumeAttemptResponseDto } from './dto/resume-attempt-response.dto';

@Injectable()
export class MockTestAttemptsService {
  private readonly logger = new Logger(MockTestAttemptsService.name);

  constructor(
    @InjectModel(MockTestAttempt.name)
    private attemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(MockTest.name)
    private mockTestModel: Model<MockTestDocument>,
    @InjectModel(Question.name)
    private questionModel: Model<QuestionDocument>,
  ) {}

  /**
   * Helper: Extract URL from ImageMetadata (only expose URL, not S3 internals)
   */
  private extractImageUrl(
    imageMetadata: any | undefined | null,
  ): string | null {
    return imageMetadata?.url || null;
  }

  /**
   * Helper: Auto-expire and evaluate an attempt if time limit exceeded
   * @param attempt - The attempt document
   * @returns true if attempt was auto-expired, false otherwise
   */
  private async autoExpireIfNeeded(
    attempt: MockTestAttemptDocument,
  ): Promise<boolean> {
    if (attempt.status !== 'IN_PROGRESS') {
      return false; // Already completed
    }

    const timeElapsed = (Date.now() - attempt.startedAt.getTime()) / 1000;
    const allowedTime = attempt.durationInMinutes * 60;

    if (timeElapsed <= allowedTime) {
      return false; // Still within time limit
    }

    // Time exceeded - auto-expire and evaluate
    this.logger.warn(
      `Auto-expiring abandoned attempt ${attempt.id} (exceeded by ${Math.floor(timeElapsed - allowedTime)}s)`,
    );

    // Fetch questions with correct answers for evaluation
    const questionIds = attempt.questions.map(q => q.question);
    const questions = await this.questionModel
      .find({ _id: { $in: questionIds } })
      .lean()
      .exec();

    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Evaluate each question
    let totalScore = 0;
    for (const attemptQuestion of attempt.questions) {
      const questionId = attemptQuestion.question.toString();
      const question = questionMap.get(questionId);

      if (!question) continue;

      const selectedOption = attemptQuestion.selectedOption;
      const correctAnswer = question.correctAnswer;

      if (!selectedOption) {
        attemptQuestion.isCorrect = false;
        attemptQuestion.marksAwarded = 0;
      } else if (selectedOption === correctAnswer) {
        attemptQuestion.isCorrect = true;
        attemptQuestion.marksAwarded = attempt.marksPerQuestion;
        totalScore += attempt.marksPerQuestion;
      } else {
        attemptQuestion.isCorrect = false;
        attemptQuestion.marksAwarded = -attempt.negativeMarking;
        totalScore -= attempt.negativeMarking;
      }
    }

    // Update attempt
    attempt.score = totalScore;
    attempt.status = 'EXPIRED';
    attempt.submittedAt = new Date();
    await attempt.save();

    return true;
  }

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

    // Step 4: Check for existing IN_PROGRESS attempt and auto-expire if needed
    const inProgressAttempt = await this.attemptModel
      .findOne({
        user: new Types.ObjectId(userId),
        test: new Types.ObjectId(mockTestId),
        status: 'IN_PROGRESS',
      })
      .exec();

    if (inProgressAttempt) {
      // Auto-expire if time exceeded
      const wasExpired = await this.autoExpireIfNeeded(inProgressAttempt);

      if (!wasExpired) {
        // Still active - block new attempt
        throw new ConflictException(
          'You already have an in-progress attempt for this test. Please complete or submit it first.',
        );
      }
      // If expired, allow starting new attempt
    }

    // Step 5: Create the attempt with frozen configuration
    const attempt = await this.attemptModel.create({
      user: new Types.ObjectId(userId),
      test: test._id,
      testTitle: test.title,
      totalQuestions: test.totalQuestions,
      durationInMinutes: test.durationInMinutes,
      exam: test.exam,
      subject: test.subject,
      topic: test.topic,
      marksPerQuestion: test.marksPerQuestion,
      negativeMarking: test.negativeMarking,
      passingScore: test.passingScore,
      shuffleOptions: test.shuffleOptions,
      showResultsImmediately: test.showResultsImmediately,
      difficultyDistribution: test.difficultyDistribution,
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

    // Step 7: Format response with simplified image data (only URLs)
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
        questionText: {
          en: {
            text: q.questionText?.en?.text || null,
            imageUrl: this.extractImageUrl(q.questionText?.en?.image),
          },
          ml: {
            text: q.questionText?.ml?.text || null,
            imageUrl: this.extractImageUrl(q.questionText?.ml?.image),
          },
        },
        optionType: q.optionType,
        options:
          q.options?.map(opt => ({
            id: opt.id,
            type: opt.type,
            en: opt.en,
            ml: opt.ml,
            imageUrl: this.extractImageUrl(opt.image),
          })) || [],
        subject: q.subject?.toString(),
        topic: q.topic?.toString(),
        difficultyLevel: q.difficultyLevel,
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
  /**
   * Get detailed attempt information (serves as resume/fallback endpoint)
   * @param attemptId - Attempt ID
   * @param userId - User ID
   * @returns Comprehensive attempt details with questions and progress
   */
  async findOne(
    attemptId: string,
    userId: string,
  ): Promise<AttemptDetailResponseDto> {
    // Step 1: Validate attempt ID
    if (!Types.ObjectId.isValid(attemptId)) {
      throw new BadRequestException('Invalid attempt ID format');
    }

    // Step 2: Fetch attempt
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

    // Step 3: Auto-expire if needed (handles abandoned attempts)
    await this.autoExpireIfNeeded(attempt);

    // Step 4: Fetch full question details (with options)
    const questionIds = attempt.questions.map(q => q.question);
    const questions = await this.questionModel
      .find({ _id: { $in: questionIds } })
      .lean()
      .exec();

    // Create question map for quick lookup
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Step 5: Calculate time metrics
    const timeElapsed = Math.floor(
      (Date.now() - attempt.startedAt.getTime()) / 1000,
    ); // seconds
    const allowedTime = attempt.durationInMinutes * 60; // seconds
    const timeRemaining = Math.max(0, allowedTime - timeElapsed);

    // Step 6: Build response based on attempt status
    const isInProgress = attempt.status === 'IN_PROGRESS';
    const isSubmitted =
      attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED';
    const showResults = isSubmitted && attempt.showResultsImmediately;

    // Step 7: Map questions with appropriate details
    const mappedQuestions = attempt.questions
      .map(aq => {
        const questionId = aq.question.toString();
        const question = questionMap.get(questionId);

        if (!question) {
          return null; // Skip if question not found
        }

        const questionDto: any = {
          _id: questionId,
          questionText: question.questionText,
          options: question.options,
          subject: question.subject.toString(),
        };

        // Always include selected answer if user has answered
        if (aq.selectedOption) {
          questionDto.selectedOption = aq.selectedOption;
        }

        // Include evaluation results only if submitted and allowed
        if (showResults) {
          questionDto.correctAnswer = question.correctAnswer;
          questionDto.isCorrect = aq.isCorrect;
          questionDto.marksAwarded = aq.marksAwarded;
          if (question.explanation) {
            questionDto.explanation = question.explanation;
          }
        }

        return questionDto;
      })
      .filter(Boolean); // Remove nulls

    // Step 8: Build base response
    const response: AttemptDetailResponseDto = {
      attemptId: attempt.id,
      status: attempt.status,
      test: {
        title: attempt.testTitle,
        durationInMinutes: attempt.durationInMinutes,
        totalQuestions: attempt.totalQuestions,
        startedAt: attempt.startedAt,
        marksPerQuestion: attempt.marksPerQuestion,
        negativeMarking: attempt.negativeMarking,
        passingScore: attempt.passingScore,
        showResultsImmediately: attempt.showResultsImmediately,
      },
      questions: mappedQuestions,
    };

    // Step 9: Add time metrics for in-progress attempts
    if (isInProgress) {
      response.timeElapsed = timeElapsed;
      response.timeRemaining = timeRemaining;
    }

    // Step 10: Add results for submitted attempts
    if (isSubmitted) {
      response.score = attempt.score;
      response.submittedAt = attempt.submittedAt;

      // Calculate answer statistics
      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;

      attempt.questions.forEach(q => {
        if (!q.selectedOption) {
          unansweredCount++;
        } else if (q.isCorrect) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      });

      response.correctAnswers = correctCount;
      response.incorrectAnswers = incorrectCount;
      response.unansweredQuestions = unansweredCount;
      response.isPassed = attempt.passingScore
        ? attempt.score >= attempt.passingScore
        : false;
    }

    return response;
  }

  /**
   * Resume attempt (for reload/reconnection scenarios)
   * Returns questions with selected options but WITHOUT correct answers or explanations
   * @param attemptId - Attempt ID
   * @param userId - User ID
   * @returns Attempt details for resuming test
   */
  async resumeAttempt(
    attemptId: string,
    userId: string,
  ): Promise<ResumeAttemptResponseDto> {
    // Step 1: Validate attempt ID
    if (!Types.ObjectId.isValid(attemptId)) {
      throw new BadRequestException('Invalid attempt ID format');
    }

    // Step 2: Fetch attempt
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

    // Step 3: Check if attempt should be auto-expired
    const wasExpired = await this.autoExpireIfNeeded(attempt);

    if (wasExpired) {
      throw new BadRequestException(
        'This attempt has expired due to time limit. Use GET /:id endpoint to view results.',
      );
    }

    // Step 4: Only allow resuming IN_PROGRESS attempts
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot resume attempt with status "${attempt.status}". Use GET /:id endpoint to view results.`,
      );
    }

    // Step 5: Fetch questions WITHOUT correct answers or explanations
    const questionIds = attempt.questions.map(q => q.question);
    const questions = await this.questionModel
      .find({ _id: { $in: questionIds } })
      .select('-correctAnswer -explanation')
      .lean()
      .exec();

    // Create question map for quick lookup
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Step 6: Calculate time metrics
    const timeElapsed = Math.floor(
      (Date.now() - attempt.startedAt.getTime()) / 1000,
    ); // seconds
    const allowedTime = attempt.durationInMinutes * 60; // seconds
    const timeRemaining = Math.max(0, allowedTime - timeElapsed);

    // Step 7: Map questions with selected options (no answers/explanations)
    const mappedQuestions = attempt.questions
      .map(aq => {
        const questionId = aq.question.toString();
        const question = questionMap.get(questionId);

        if (!question) {
          return null;
        }

        const questionDto: any = {
          _id: questionId,
          questionText: {
            en: {
              text: question.questionText?.en?.text || null,
              imageUrl: this.extractImageUrl(question.questionText?.en?.image),
            },
            ml: {
              text: question.questionText?.ml?.text || null,
              imageUrl: this.extractImageUrl(question.questionText?.ml?.image),
            },
          },
          optionType: question.optionType,
          options: question.options.map(opt => ({
            id: opt.id,
            type: opt.type,
            en: opt.en,
            ml: opt.ml,
            imageUrl: this.extractImageUrl(opt.image),
          })),
          subject: question.subject?.toString(),
          topic: question.topic?.toString(),
          difficultyLevel: question.difficultyLevel,
        };

        // Include selected option if user has answered
        if (aq.selectedOption) {
          questionDto.selectedOption = aq.selectedOption;
        }

        return questionDto;
      })
      .filter(Boolean);

    // Step 8: Build response
    const response: ResumeAttemptResponseDto = {
      attemptId: attempt.id,
      test: {
        title: attempt.testTitle,
        durationInMinutes: attempt.durationInMinutes,
        totalQuestions: attempt.totalQuestions,
        startedAt: attempt.startedAt,
        marksPerQuestion: attempt.marksPerQuestion,
        negativeMarking: attempt.negativeMarking,
        passingScore: attempt.passingScore,
      },
      questions: mappedQuestions,
      timeElapsed,
      timeRemaining,
    };

    return response;
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

    // Auto-expire any abandoned IN_PROGRESS attempts
    for (const attempt of attempts) {
      await this.autoExpireIfNeeded(attempt);
    }

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

    // Auto-expire any abandoned IN_PROGRESS attempts
    for (const attempt of attempts) {
      await this.autoExpireIfNeeded(attempt);
    }

    return attempts;
  }

  /**
   * Update answer for a question in an attempt
   * @param attemptId - Attempt ID
   * @param userId - User ID
   * @param updateAnswerDto - Contains questionId and selectedOptionId
   * @returns Success indicator
   */
  async updateAnswer(
    attemptId: string,
    userId: string,
    updateAnswerDto: UpdateAnswerDto,
  ): Promise<void> {
    const { questionId, selectedOptionId } = updateAnswerDto;

    // Step 1: Validate attempt ID format
    if (!Types.ObjectId.isValid(attemptId)) {
      throw new BadRequestException('Invalid attempt ID format');
    }

    // Step 2: Validate question ID format
    if (!Types.ObjectId.isValid(questionId)) {
      throw new BadRequestException('Invalid question ID format');
    }

    // Step 3: Fetch the attempt
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

    // Step 4: Validate attempt status
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot update answers for attempt with status "${attempt.status}". Only IN_PROGRESS attempts can be updated.`,
      );
    }

    // Step 5: Check if attempt has expired
    const timeElapsed = (Date.now() - attempt.startedAt.getTime()) / 1000; // in seconds
    const allowedTime = attempt.durationInMinutes * 60; // in seconds

    if (timeElapsed > allowedTime) {
      // Mark attempt as expired
      await this.attemptModel.updateOne(
        { _id: attemptId },
        { $set: { status: 'EXPIRED' } },
      );

      throw new BadRequestException(
        'Test has expired. You can no longer update answers.',
      );
    }

    // Step 6: Verify question exists in the attempt
    const questionExists = attempt.questions.some(
      q => q.question.toString() === questionId,
    );

    if (!questionExists) {
      throw new BadRequestException(
        `Question with ID "${questionId}" is not part of this attempt`,
      );
    }

    // Step 7: Update the selected answer using positional operator
    await this.attemptModel
      .updateOne(
        {
          _id: attemptId,
          'questions.question': new Types.ObjectId(questionId),
        },
        {
          $set: {
            'questions.$.selectedOption': selectedOptionId,
          },
        },
      )
      .exec();
  }

  /**
   * Submit attempt and evaluate results
   * @param attemptId - Attempt ID
   * @param userId - User ID
   * @param submitAttemptDto - Optional answers to update before submission
   * @returns Submission results with score and details
   */
  async submitAttempt(
    attemptId: string,
    userId: string,
    submitAttemptDto?: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponseDto> {
    // Step 1: Validate attempt ID format
    if (!Types.ObjectId.isValid(attemptId)) {
      throw new BadRequestException('Invalid attempt ID format');
    }

    // Step 2: Fetch the attempt
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

    // Step 3: Validate attempt status
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot submit attempt with status "${attempt.status}". Only IN_PROGRESS attempts can be submitted.`,
      );
    }

    // Step 4: Server-side timer check
    const timeElapsed = (Date.now() - attempt.startedAt.getTime()) / 1000; // in seconds
    const allowedTime = attempt.durationInMinutes * 60; // in seconds
    const GRACE_PERIOD_SECONDS = 10; // Allow 10 seconds for network delays
    const isExpired = timeElapsed > allowedTime;
    const exceededBySeconds = timeElapsed - allowedTime;
    const isWithinGracePeriod = exceededBySeconds <= GRACE_PERIOD_SECONDS;

    // If expired, mark as EXPIRED but continue to evaluate
    if (isExpired) {
      attempt.status = 'EXPIRED';
    }

    // Step 5: Optional - Update answers from request (protects against last-second internet loss)
    // Only accept answers if within time OR within grace period after expiry
    const shouldAcceptAnswers =
      !isExpired || (isExpired && isWithinGracePeriod);

    if (submitAttemptDto?.answers && submitAttemptDto.answers.length > 0) {
      if (shouldAcceptAnswers) {
        // Accept and process answers
        for (const answer of submitAttemptDto.answers) {
          if (!Types.ObjectId.isValid(answer.questionId)) {
            continue; // Skip invalid IDs
          }

          // Update each answer
          await this.attemptModel
            .updateOne(
              {
                _id: attemptId,
                'questions.question': new Types.ObjectId(answer.questionId),
              },
              {
                $set: {
                  'questions.$.selectedOption': answer.selectedOptionId,
                },
              },
            )
            .exec();
        }

        // Refresh attempt after updates
        const updatedAttempt = await this.attemptModel
          .findById(attemptId)
          .exec();
        if (updatedAttempt) {
          attempt.questions = updatedAttempt.questions;
        }
      } else {
        // Reject answers - time exceeded beyond grace period
        this.logger.warn(
          `Attempt ${attemptId}: Answers rejected - timer exceeded by ${Math.floor(exceededBySeconds)} seconds (grace period: ${GRACE_PERIOD_SECONDS}s)`,
        );
      }
    }

    // Step 6: Fetch all questions with correct answers and explanations
    const questionIds = attempt.questions.map(q => q.question);
    const questions = await this.questionModel
      .find({ _id: { $in: questionIds } })
      .lean()
      .exec();

    // Create a map for quick lookup
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Step 7: Evaluate each question
    let totalScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    for (const attemptQuestion of attempt.questions) {
      const questionId = attemptQuestion.question.toString();
      const question = questionMap.get(questionId);

      if (!question) {
        continue; // Skip if question not found
      }

      const selectedOption = attemptQuestion.selectedOption;
      const correctAnswer = question.correctAnswer;

      if (!selectedOption) {
        // Unanswered - no marks, no negative marking
        attemptQuestion.isCorrect = false;
        attemptQuestion.marksAwarded = 0;
        unansweredCount++;
      } else if (selectedOption === correctAnswer) {
        // Correct answer
        attemptQuestion.isCorrect = true;
        attemptQuestion.marksAwarded = attempt.marksPerQuestion;
        totalScore += attempt.marksPerQuestion;
        correctCount++;
      } else {
        // Incorrect answer - apply negative marking
        attemptQuestion.isCorrect = false;
        attemptQuestion.marksAwarded = -attempt.negativeMarking;
        totalScore -= attempt.negativeMarking;
        incorrectCount++;
      }
    }

    // Step 8: Update attempt with final results
    const submittedAt = new Date();
    attempt.score = totalScore;
    attempt.status = isExpired ? 'EXPIRED' : 'SUBMITTED';
    attempt.submittedAt = submittedAt;

    await attempt.save();

    // Step 9: Prepare response
    const totalPossibleScore =
      attempt.totalQuestions * attempt.marksPerQuestion;
    const passed = attempt.passingScore
      ? totalScore >= attempt.passingScore
      : false;

    const response: SubmitAttemptResponseDto = {
      attemptId: attempt.id,
      score: totalScore,
      totalScore: totalPossibleScore,
      passingScore: attempt.passingScore,
      passed,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      unansweredQuestions: unansweredCount,
      submittedAt,
      timeTaken: Math.floor(timeElapsed),
    };

    // Step 10: Include detailed results if showResultsImmediately is true
    if (attempt.showResultsImmediately) {
      response.questionResults = attempt.questions.map(aq => {
        const questionId = aq.question.toString();
        const question = questionMap.get(questionId);

        return {
          questionId,
          selectedOption: aq.selectedOption,
          correctAnswer: question?.correctAnswer || '',
          isCorrect: aq.isCorrect || false,
          marksAwarded: aq.marksAwarded,
          explanation: question?.explanation
            ? {
                en: question.explanation.en || null,
                ml: question.explanation.ml || null,
                imageUrl: this.extractImageUrl(question.explanation.image),
              }
            : undefined,
        };
      });
    }

    return response;
  }
}
