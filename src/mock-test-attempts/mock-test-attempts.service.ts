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
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';

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
    const isExpired = timeElapsed > allowedTime;

    // If expired, mark as EXPIRED but continue to evaluate
    if (isExpired) {
      attempt.status = 'EXPIRED';
    }

    // Step 5: Optional - Update answers from request (protects against last-second internet loss)
    if (submitAttemptDto?.answers && submitAttemptDto.answers.length > 0) {
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
      const updatedAttempt = await this.attemptModel.findById(attemptId).exec();
      if (updatedAttempt) {
        attempt.questions = updatedAttempt.questions;
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
          explanation: question?.explanation,
        };
      });
    }

    return response;
  }
}
