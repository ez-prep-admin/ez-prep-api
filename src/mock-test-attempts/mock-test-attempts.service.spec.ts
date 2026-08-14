import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MockTestAttemptsService } from './mock-test-attempts.service';
import { MockTestAttempt } from './schemas/mock-test-attempt.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';
import { Question } from './schemas/question.schema';
import { ImageUrlResolver } from '../aws/s3/image-url.resolver';

const TEST_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';
const ATTEMPT_ID = '507f1f77bcf86cd799439013';
const Q1 = '507f1f77bcf86cd799439014';
const Q2 = '507f1f77bcf86cd799439015';
const EXAM_ID = '507f1f77bcf86cd799439016';
const SUB_ID = '507f1f77bcf86cd799439017';
const TOP_ID = '507f1f77bcf86cd799439018';

function chainable(resolved: unknown) {
  const query: any = {};
  ['populate', 'sort', 'skip', 'limit', 'lean', 'select', 'session'].forEach(
    m => {
      query[m] = jest.fn().mockReturnValue(query);
    },
  );
  query.exec = jest.fn().mockResolvedValue(resolved);
  return query;
}

function questionDoc(id = Q1, correct = 'a') {
  return {
    _id: { toString: () => id },
    correctAnswer: correct,
    explanation: { en: 'why', ml: null, image: null, images: [] },
    questionText: { en: { text: 'Q', image: null }, ml: { text: null } },
    optionType: 'text',
    options: [{ id: 'a', type: 'text', en: 'A', ml: null }],
    subject: { toString: () => SUB_ID },
    topic: { toString: () => TOP_ID },
    difficultyLevel: 'easy',
  };
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(TEST_ID),
    title: 'Paper',
    isActive: true,
    allowRetake: true,
    totalQuestions: 2,
    durationInMinutes: 10,
    exam: {
      _id: { toString: () => EXAM_ID },
      name: 'Exam',
      description: 'd',
    },
    subject: {
      _id: { toString: () => SUB_ID },
      name: 'Sub',
      description: 's',
    },
    topic: { _id: { toString: () => TOP_ID }, name: 'Top' },
    marksPerQuestion: 1,
    negativeMarking: 0.25,
    passingScore: 1,
    shuffleOptions: false,
    showResultsImmediately: true,
    difficultyDistribution: { easy: 1, medium: 1, hard: 0 },
    questionIds: [new Types.ObjectId(Q1), new Types.ObjectId(Q2)],
    subjectConfig: [],
    isSessionWise: false,
    ...overrides,
  };
}

function makeAttempt(overrides: Record<string, unknown> = {}) {
  const startedAt = new Date(Date.now() - 30_000);
  const attempt: any = {
    id: ATTEMPT_ID,
    _id: new Types.ObjectId(ATTEMPT_ID),
    testTitle: 'Paper',
    status: 'IN_PROGRESS',
    durationInMinutes: 10,
    totalQuestions: 2,
    marksPerQuestion: 1,
    negativeMarking: 0.25,
    passingScore: 1,
    showResultsImmediately: true,
    startedAt,
    timeConsumed: 0,
    score: 0,
    isSessionWise: false,
    currentSessionIndex: 0,
    sessions: [],
    pauseResumeHistory: [],
    exam: {
      _id: { toString: () => EXAM_ID },
      name: 'Exam',
      description: 'd',
    },
    subject: {
      _id: { toString: () => SUB_ID },
      name: 'Sub',
      description: 's',
    },
    topic: {
      _id: { toString: () => TOP_ID },
      name: 'Top',
      description: 't',
    },
    mockTest: {
      _id: { toString: () => TEST_ID },
      title: 'Paper',
      totalQuestions: 2,
      marksPerQuestion: 1,
    },
    questions: [
      {
        question: { toString: () => Q1 },
        selectedOption: 'a',
        isCorrect: null,
        marksAwarded: 0,
        marksPerQuestion: 1,
        negativeMarking: 0.25,
      },
      {
        question: { toString: () => Q2 },
        selectedOption: null,
        isCorrect: null,
        marksAwarded: 0,
        marksPerQuestion: 1,
        negativeMarking: 0.25,
      },
    ],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return attempt;
}

describe('MockTestAttemptsService', () => {
  let service: MockTestAttemptsService;
  const attemptModel: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  };
  const mockTestModel: any = { findById: jest.fn() };
  const questionModel: any = { find: jest.fn() };
  const imageUrlResolver = {
    resolveMany: jest.fn().mockResolvedValue([null, null, null]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockTestAttemptsService,
        {
          provide: getModelToken(MockTestAttempt.name),
          useValue: attemptModel,
        },
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
        { provide: getModelToken(Question.name), useValue: questionModel },
        { provide: ImageUrlResolver, useValue: imageUrlResolver },
      ],
    }).compile();

    service = module.get(MockTestAttemptsService);
    jest.clearAllMocks();
    attemptModel.findOne.mockReset();
    attemptModel.find.mockReset();
    attemptModel.findById.mockReset();
    attemptModel.create.mockReset();
    attemptModel.updateOne.mockReset();
    mockTestModel.findById.mockReset();
    questionModel.find.mockReset();
    imageUrlResolver.resolveMany.mockResolvedValue([null, null, null]);
    attemptModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startAttempt', () => {
    it('should reject invalid ids', async () => {
      await expect(
        service.startAttempt({ mockTestId: 'bad' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFound when test missing', async () => {
      mockTestModel.findById.mockReturnValue(chainable(null));
      await expect(
        service.startAttempt({ mockTestId: TEST_ID }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject inactive tests', async () => {
      mockTestModel.findById.mockReturnValue(
        chainable(makeTest({ isActive: false })),
      );
      await expect(
        service.startAttempt({ mockTestId: TEST_ID }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject retakes when not allowed', async () => {
      mockTestModel.findById.mockReturnValue(
        chainable(makeTest({ allowRetake: false })),
      );
      attemptModel.findOne.mockReturnValue(chainable({ id: ATTEMPT_ID }));

      await expect(
        service.startAttempt({ mockTestId: TEST_ID }, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject when an in-progress attempt is still active', async () => {
      mockTestModel.findById.mockReturnValue(chainable(makeTest()));
      const inProgress = makeAttempt();
      attemptModel.findOne.mockReturnValue(chainable(inProgress));

      await expect(
        service.startAttempt({ mockTestId: TEST_ID }, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should start a topic-wise attempt', async () => {
      mockTestModel.findById.mockReturnValue(chainable(makeTest()));
      attemptModel.findOne.mockReturnValue(chainable(null));
      attemptModel.create.mockResolvedValue(
        makeAttempt({ id: ATTEMPT_ID, startedAt: new Date() }),
      );
      questionModel.find.mockReturnValue(
        chainable([questionDoc(Q1), questionDoc(Q2, 'b')]),
      );

      const result = await service.startAttempt({ mockTestId: TEST_ID }, USER_ID);

      expect(result.attemptId).toBe(ATTEMPT_ID);
      expect(result.questions).toHaveLength(2);
      expect(attemptModel.create).toHaveBeenCalled();
    });

    it('should start a session-wise full exam with per-question marks', async () => {
      const test = makeTest({
        isSessionWise: true,
        subjectConfig: [
          {
            subject: new Types.ObjectId(SUB_ID),
            name: 'Physics',
            questionStartIndex: 0,
            questionEndIndex: 0,
            marksPerQuestion: 2,
            hasNegativeMarking: true,
            negativeMarksPerQuestion: 0.5,
            sessionTime: 20,
          },
          {
            subject: new Types.ObjectId(SUB_ID),
            name: 'Chem',
            questionStartIndex: 1,
            questionEndIndex: 1,
            marksPerQuestion: 1,
            hasNegativeMarking: false,
            negativeMarksPerQuestion: 0,
            sessionTime: 20,
          },
        ],
      });
      mockTestModel.findById.mockReturnValue(chainable(test));
      attemptModel.findOne.mockReturnValue(chainable(null));
      attemptModel.create.mockResolvedValue(
        makeAttempt({
          isSessionWise: true,
          currentSessionIndex: 0,
          sessions: [
            {
              subject: SUB_ID,
              name: 'Physics',
              order: 0,
              durationInMinutes: 20,
              startIndex: 0,
              endIndex: 0,
              status: 'IN_PROGRESS',
              startedAt: new Date(),
              timeConsumed: 0,
            },
          ],
        }),
      );
      questionModel.find.mockReturnValue(chainable([questionDoc()]));

      const result = await service.startAttempt({ mockTestId: TEST_ID }, USER_ID);
      expect(result.mockTestData.isSessionWise).toBe(true);
    });

    it('should expire abandoned in-progress attempts then start a new one', async () => {
      mockTestModel.findById.mockReturnValue(chainable(makeTest()));
      const expired = makeAttempt({
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        durationInMinutes: 1,
      });
      questionModel.find.mockReturnValue(chainable([questionDoc(Q1)]));
      attemptModel.findOne.mockReturnValue(chainable(expired));
      attemptModel.create.mockResolvedValue(makeAttempt());

      const result = await service.startAttempt({ mockTestId: TEST_ID }, USER_ID);
      expect(expired.status).toBe('EXPIRED');
      expect(expired.save).toHaveBeenCalled();
      expect(result.attemptId).toBe(ATTEMPT_ID);
    });
  });

  describe('pauseAttempt', () => {
    it('should reject invalid attempt ids', async () => {
      await expect(service.pauseAttempt('bad', USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should 404 when attempt is missing', async () => {
      attemptModel.findOne.mockReturnValue(chainable(null));
      await expect(service.pauseAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject non in-progress attempts', async () => {
      attemptModel.findOne.mockReturnValue(
        chainable(makeAttempt({ status: 'PAUSED' })),
      );
      await expect(service.pauseAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when time already expired', async () => {
      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            startedAt: new Date(Date.now() - 20 * 60 * 1000),
            durationInMinutes: 1,
          }),
        ),
      );
      await expect(service.pauseAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /already expired/,
      );
    });

    it('should pause and record history', async () => {
      const attempt = makeAttempt();
      attemptModel.findOne.mockReturnValue(chainable(attempt));

      const result = await service.pauseAttempt(ATTEMPT_ID, USER_ID);

      expect(result.status).toBe('PAUSED');
      expect(attempt.status).toBe('PAUSED');
      expect(result.pauseCount).toBe(1);
    });

    it('should pause a session-wise attempt', async () => {
      const attempt = makeAttempt({
        isSessionWise: true,
        sessions: [
          {
            subject: SUB_ID,
            name: 'P',
            order: 0,
            durationInMinutes: 20,
            startIndex: 0,
            endIndex: 1,
            status: 'IN_PROGRESS',
            startedAt: new Date(Date.now() - 5000),
            timeConsumed: 10,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));

      const result = await service.pauseAttempt(ATTEMPT_ID, USER_ID);
      expect(result.status).toBe('PAUSED');
      expect(attempt.sessions[0].status).toBe('PAUSED');
    });
  });

  describe('findOne', () => {
    it('should validate and 404', async () => {
      await expect(service.findOne('x', USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      attemptModel.findOne.mockReturnValue(chainable(null));
      await expect(service.findOne(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return in-progress details with remaining time', async () => {
      attemptModel.findOne.mockReturnValue(chainable(makeAttempt()));
      questionModel.find.mockReturnValue(chainable([questionDoc(Q1)]));

      const result = await service.findOne(ATTEMPT_ID, USER_ID);
      expect(result.attemptId).toBe(ATTEMPT_ID);
      expect(result.timeRemaining).toBeGreaterThan(0);
    });

    it('should include results when submitted and showResultsImmediately', async () => {
      const attempt = makeAttempt({
        status: 'SUBMITTED',
        score: 1,
        submittedAt: new Date(),
        questions: [
          {
            question: { toString: () => Q1 },
            selectedOption: 'a',
            isCorrect: true,
            marksAwarded: 1,
          },
          {
            question: { toString: () => Q2 },
            selectedOption: 'b',
            isCorrect: false,
            marksAwarded: -0.25,
          },
          {
            question: { toString: () => '507f1f77bcf86cd799439099' },
            selectedOption: null,
            isCorrect: false,
            marksAwarded: 0,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(
        chainable([questionDoc(Q1), questionDoc(Q2, 'a')]),
      );

      const result = await service.findOne(ATTEMPT_ID, USER_ID);
      expect(result.correctAnswers).toBe(1);
      expect(result.incorrectAnswers).toBe(1);
      expect(result.unansweredQuestions).toBe(1);
      expect(result.isPassed).toBe(true);
    });

    it('omits topic and uses paused elapsed time', async () => {
      const attempt = makeAttempt({
        status: 'PAUSED',
        timeConsumed: 12,
        topic: undefined,
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(chainable([questionDoc(Q1)]));

      const result = await service.findOne(ATTEMPT_ID, USER_ID);
      expect(result.timeElapsed).toBe(12);
      expect(result.test.topic).toBeUndefined();
    });
  });

  describe('resumeAttempt', () => {
    it('should reject expired attempts', async () => {
      const attempt = makeAttempt({
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        durationInMinutes: 1,
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(chainable([questionDoc()]));

      await expect(service.resumeAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /expired/,
      );
    });

    it('should reject submitted attempts', async () => {
      attemptModel.findOne.mockReturnValue(
        chainable(makeAttempt({ status: 'SUBMITTED' })),
      );
      await expect(service.resumeAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should resume a paused attempt', async () => {
      const attempt = makeAttempt({
        status: 'PAUSED',
        timeConsumed: 40,
        isSessionWise: true,
        sessions: [
          {
            subject: SUB_ID,
            name: 'P',
            order: 0,
            durationInMinutes: 20,
            startIndex: 0,
            endIndex: 1,
            status: 'PAUSED',
            startedAt: new Date(),
            timeConsumed: 40,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(chainable([questionDoc(Q1)]));

      const result = await service.resumeAttempt(ATTEMPT_ID, USER_ID);
      expect(attempt.status).toBe('IN_PROGRESS');
      expect(result.timeConsumed).toBe(40);
      expect(result.pauseCount).toBeUndefined();
    });

    it('should 404 and reject invalid ids', async () => {
      await expect(service.resumeAttempt('nope', USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      attemptModel.findOne.mockReturnValue(chainable(null));
      await expect(service.resumeAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUserAttempts / findUserTestAttempts', () => {
    it('should map summaries', async () => {
      attemptModel.find.mockReturnValue(chainable([makeAttempt()]));
      const rows = await service.findUserAttempts(USER_ID);
      expect(rows[0].mockTestTitle).toBe('Paper');
      expect(rows[0].totalMarks).toBe(2);
    });

    it('should validate mockTestId', async () => {
      await expect(
        service.findUserTestAttempts(USER_ID, 'bad'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should list attempts for a test', async () => {
      attemptModel.find.mockReturnValue(chainable([makeAttempt()]));
      const rows = await service.findUserTestAttempts(USER_ID, TEST_ID);
      expect(rows).toHaveLength(1);
    });
  });

  describe('updateAnswer', () => {
    it('should validate ids', async () => {
      await expect(
        service.updateAnswer('x', USER_ID, {
          questionId: Q1,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: 'x',
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should 404 missing attempts and reject non in-progress', async () => {
      attemptModel.findOne.mockReturnValue(chainable(null));
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: Q1,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(NotFoundException);

      attemptModel.findOne.mockReturnValue(
        chainable(makeAttempt({ status: 'PAUSED' })),
      );
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: Q1,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired papers and mid-session expiry', async () => {
      const expiredPaper = makeAttempt({
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        durationInMinutes: 1,
      });
      questionModel.find.mockReturnValue(chainable([questionDoc()]));
      attemptModel.findOne.mockReturnValue(chainable(expiredPaper));
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: Q1,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(/expired/);

      const sessionExpired = makeAttempt({
        isSessionWise: true,
        currentSessionIndex: 0,
        durationInMinutes: 1,
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        sessions: [
          {
            status: 'IN_PROGRESS',
            durationInMinutes: 1,
            startedAt: new Date(Date.now() - 20 * 60 * 1000),
            timeConsumed: 0,
            startIndex: 0,
            endIndex: 0,
            name: 'P',
            order: 0,
            subject: SUB_ID,
          },
          {
            status: 'LOCKED',
            durationInMinutes: 1,
            startIndex: 1,
            endIndex: 1,
            name: 'C',
            order: 1,
            subject: SUB_ID,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(sessionExpired));
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: Q1,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(/session has expired/);
    });

    it('should reject unknown questions and out-of-session questions', async () => {
      attemptModel.findOne.mockReturnValue(chainable(makeAttempt()));
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: EXAM_ID,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(/not part of this attempt/);

      const sessionAttempt = makeAttempt({
        isSessionWise: true,
        sessions: [
          {
            status: 'IN_PROGRESS',
            durationInMinutes: 20,
            startedAt: new Date(),
            timeConsumed: 0,
            startIndex: 0,
            endIndex: 0,
            name: 'P',
            order: 0,
            subject: SUB_ID,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(sessionAttempt));
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: Q2,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(/current session/);
    });

    it('should update a valid answer', async () => {
      attemptModel.findOne.mockReturnValue(chainable(makeAttempt()));
      await service.updateAnswer(ATTEMPT_ID, USER_ID, {
        questionId: Q1,
        selectedOptionId: 'b',
      });
      expect(attemptModel.updateOne).toHaveBeenCalled();
    });

    it('rejects answers when the current session is not in progress', async () => {
      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            isSessionWise: true,
            sessions: [
              {
                status: 'PAUSED',
                durationInMinutes: 20,
                startedAt: new Date(),
                timeConsumed: 0,
                startIndex: 0,
                endIndex: 1,
                name: 'P',
                order: 0,
                subject: SUB_ID,
              },
            ],
          }),
        ),
      );
      await expect(
        service.updateAnswer(ATTEMPT_ID, USER_ID, {
          questionId: Q1,
          selectedOptionId: 'a',
        }),
      ).rejects.toThrow(/session is not active/);
    });
  });

  describe('submitAttempt', () => {
    it('should validate and 404', async () => {
      await expect(service.submitAttempt('x', USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      attemptModel.findOne.mockReturnValue(chainable(null));
      await expect(service.submitAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject paused and mid-session submit', async () => {
      attemptModel.findOne.mockReturnValue(
        chainable(makeAttempt({ status: 'PAUSED' })),
      );
      await expect(service.submitAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );

      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            isSessionWise: true,
            currentSessionIndex: 0,
            sessions: [
              {
                status: 'IN_PROGRESS',
                durationInMinutes: 20,
                startedAt: new Date(),
                startIndex: 0,
                endIndex: 0,
                name: 'P',
                order: 0,
                subject: SUB_ID,
                timeConsumed: 0,
              },
              {
                status: 'LOCKED',
                durationInMinutes: 20,
                startIndex: 1,
                endIndex: 1,
                name: 'C',
                order: 1,
                subject: SUB_ID,
                timeConsumed: 0,
              },
            ],
          }),
        ),
      );
      await expect(service.submitAttempt(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /session-wise/,
      );
    });

    it('should score answers and include results', async () => {
      const attempt = makeAttempt();
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      attemptModel.findById.mockReturnValue(
        chainable({ questions: attempt.questions }),
      );
      questionModel.find.mockReturnValue(
        chainable([questionDoc(Q1, 'a'), questionDoc(Q2, 'b')]),
      );

      const result = await service.submitAttempt(ATTEMPT_ID, USER_ID, {
        answers: [
          { questionId: Q2, selectedOptionId: 'b' },
          { questionId: 'not-an-id', selectedOptionId: 'x' },
          { questionId: EXAM_ID, selectedOptionId: 'x' },
        ],
      });

      expect(result.correctAnswers).toBe(1);
      expect(result.unansweredQuestions).toBe(1);
      expect(result.questionResults).toBeDefined();
      expect(attempt.status).toBe('SUBMITTED');
    });

    it('should mark expired submits and skip late answers', async () => {
      const attempt = makeAttempt({
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        durationInMinutes: 1,
        showResultsImmediately: false,
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(chainable([questionDoc()]));

      const result = await service.submitAttempt(ATTEMPT_ID, USER_ID, {
        answers: [{ questionId: Q1, selectedOptionId: 'z' }],
      });
      expect(result.questionResults).toBeUndefined();
      expect(attempt.status).toBe('EXPIRED');
    });

    it('applies negative marks for incorrect answers', async () => {
      const attempt = makeAttempt({
        questions: [
          {
            question: { toString: () => Q1 },
            selectedOption: 'z',
            isCorrect: null,
            marksAwarded: 0,
            marksPerQuestion: 1,
            negativeMarking: 0.25,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      attemptModel.findById.mockReturnValue(
        chainable({ questions: attempt.questions }),
      );
      questionModel.find.mockReturnValue(chainable([questionDoc(Q1, 'a')]));

      const result = await service.submitAttempt(ATTEMPT_ID, USER_ID);
      expect(result.incorrectAnswers).toBe(1);
      expect(result.score).toBe(-0.25);
    });

    it('skips answers outside the current session on submit', async () => {
      const attempt = makeAttempt({
        isSessionWise: true,
        currentSessionIndex: 0,
        sessions: [
          {
            status: 'IN_PROGRESS',
            durationInMinutes: 20,
            startedAt: new Date(),
            timeConsumed: 0,
            startIndex: 0,
            endIndex: 0,
            name: 'P',
            order: 0,
            subject: SUB_ID,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      attemptModel.findById.mockReturnValue(
        chainable({ questions: attempt.questions }),
      );
      questionModel.find.mockReturnValue(
        chainable([questionDoc(Q1, 'a'), questionDoc(Q2, 'b')]),
      );

      await service.submitAttempt(ATTEMPT_ID, USER_ID, {
        answers: [{ questionId: Q2, selectedOptionId: 'b' }],
      });
      expect(attempt.status).toBe('SUBMITTED');
    });
  });

  describe('completeSession', () => {
    it('should validate and reject non session-wise', async () => {
      await expect(service.completeSession('x', USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      attemptModel.findOne.mockReturnValue(chainable(null));
      await expect(service.completeSession(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      attemptModel.findOne.mockReturnValue(chainable(makeAttempt()));
      await expect(service.completeSession(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /not session-wise/,
      );
    });

    it('should reject paused, finished, locked sessions', async () => {
      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            isSessionWise: true,
            status: 'PAUSED',
            sessions: [{ status: 'PAUSED', durationInMinutes: 10 }],
          }),
        ),
      );
      await expect(service.completeSession(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /Resume/,
      );

      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            isSessionWise: true,
            status: 'SUBMITTED',
            sessions: [{ status: 'SUBMITTED', durationInMinutes: 10 }],
          }),
        ),
      );
      await expect(service.completeSession(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /status/,
      );

      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            isSessionWise: true,
            status: 'IN_PROGRESS',
            currentSessionIndex: 0,
            sessions: [
              {
                status: 'LOCKED',
                durationInMinutes: 10,
                startedAt: new Date(),
                startIndex: 0,
                endIndex: 0,
                name: 'P',
                order: 0,
                subject: SUB_ID,
                timeConsumed: 0,
              },
            ],
          }),
        ),
      );
      await expect(service.completeSession(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /locked/,
      );

      attemptModel.findOne.mockReturnValue(
        chainable(
          makeAttempt({
            isSessionWise: true,
            currentSessionIndex: 9,
            sessions: [
              {
                status: 'IN_PROGRESS',
                durationInMinutes: 10,
                startedAt: new Date(),
                startIndex: 0,
                endIndex: 0,
                name: 'P',
                order: 0,
                subject: SUB_ID,
                timeConsumed: 0,
              },
            ],
          }),
        ),
      );
      await expect(service.completeSession(ATTEMPT_ID, USER_ID)).rejects.toThrow(
        /No active session/,
      );
    });

    it('should unlock the next session', async () => {
      const attempt = makeAttempt({
        isSessionWise: true,
        currentSessionIndex: 0,
        sessions: [
          {
            status: 'IN_PROGRESS',
            durationInMinutes: 20,
            startedAt: new Date(),
            startIndex: 0,
            endIndex: 0,
            name: 'P',
            order: 0,
            subject: SUB_ID,
            timeConsumed: 0,
          },
          {
            status: 'LOCKED',
            durationInMinutes: 20,
            startIndex: 1,
            endIndex: 1,
            name: 'C',
            order: 1,
            subject: SUB_ID,
            timeConsumed: 0,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(chainable([questionDoc(Q1)]));

      const result = await service.completeSession(ATTEMPT_ID, USER_ID);
      expect(result.paperCompleted).toBe(false);
      expect(result.nextSession).toBeDefined();
      expect(attempt.currentSessionIndex).toBe(1);
    });

    it('should submit on last session', async () => {
      const attempt = makeAttempt({
        isSessionWise: true,
        currentSessionIndex: 0,
        sessions: [
          {
            status: 'IN_PROGRESS',
            durationInMinutes: 20,
            startedAt: new Date(),
            startIndex: 0,
            endIndex: 1,
            name: 'P',
            order: 0,
            subject: SUB_ID,
            timeConsumed: 0,
          },
        ],
      });
      attemptModel.findOne.mockReturnValue(chainable(attempt));
      questionModel.find.mockReturnValue(
        chainable([questionDoc(Q1), questionDoc(Q2)]),
      );
      attemptModel.findById.mockReturnValue(chainable(attempt));

      const result = await service.completeSession(ATTEMPT_ID, USER_ID);
      expect(result.paperCompleted).toBe(true);
      expect(result.results).toBeDefined();
    });
  });
});
