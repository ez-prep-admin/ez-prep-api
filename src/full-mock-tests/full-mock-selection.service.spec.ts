import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FullMockSelectionService } from './full-mock-selection.service';
import { Subject } from '../subjects/schemas/subject.schema';
import { Topic } from '../topics/schemas/topic.schema';
import { Question } from '../mock-test-attempts/schemas/question.schema';

const SUB_ID = '507f1f77bcf86cd799439011';
const TOP_ID = '507f1f77bcf86cd799439012';
const Q1 = '507f1f77bcf86cd799439013';
const Q2 = '507f1f77bcf86cd799439014';

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

function exam(overrides: Record<string, unknown> = {}) {
  return {
    totalQuestions: 2,
    totalMarks: 4,
    duration: 60,
    isSessionWise: false,
    subjects: [
      {
        subject: new Types.ObjectId(SUB_ID),
        numberOfQuestions: 2,
        marksPerQuestion: 2,
        hasNegativeMarking: true,
        negativeMarksPerQuestion: 0.5,
        sessionTime: 30,
      },
    ],
    ...overrides,
  } as any;
}

describe('FullMockSelectionService', () => {
  let service: FullMockSelectionService;
  const subjectModel: any = { findById: jest.fn() };
  const topicModel: any = { find: jest.fn() };
  const questionModel: any = {
    countDocuments: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FullMockSelectionService,
        { provide: getModelToken(Subject.name), useValue: subjectModel },
        { provide: getModelToken(Topic.name), useValue: topicModel },
        { provide: getModelToken(Question.name), useValue: questionModel },
      ],
    }).compile();

    service = module.get(FullMockSelectionService);
    jest.clearAllMocks();
  });

  describe('assertBlueprint', () => {
    it('should reject empty subjects and mismatches', () => {
      expect(() =>
        service.assertBlueprint({
          subjects: [],
          totalQuestions: 10,
        } as any),
      ).toThrow(BadRequestException);

      expect(() =>
        service.assertBlueprint({
          subjects: [
            { subject: SUB_ID, numberOfQuestions: 1, marksPerQuestion: 1 },
          ],
          totalQuestions: 2,
          totalMarks: 99,
          duration: 0,
          isSessionWise: false,
        } as any),
      ).toThrow(BadRequestException);
    });

    it('should require session times when session-wise', () => {
      expect(() =>
        service.assertBlueprint({
          subjects: [
            {
              subject: SUB_ID,
              numberOfQuestions: 1,
              marksPerQuestion: 1,
              sessionTime: 0,
            },
          ],
          totalQuestions: 1,
          isSessionWise: true,
        } as any),
      ).toThrow(BadRequestException);
    });

    it('should accept a valid mixed blueprint', () => {
      expect(() => service.assertBlueprint(exam())).not.toThrow();
    });

    it('requires duration for mixed papers', () => {
      expect(() =>
        service.assertBlueprint({
          subjects: [
            { subject: SUB_ID, numberOfQuestions: 2, marksPerQuestion: 2 },
          ],
          totalQuestions: 2,
          totalMarks: 4,
          isSessionWise: false,
        } as any),
      ).toThrow(BadRequestException);
    });
  });

  describe('generatePaper', () => {
    it('should throw when a subject id is missing on a row that passed blueprint', async () => {
      const bad = exam({
        subjects: [
          {
            subject: null,
            numberOfQuestions: 2,
            marksPerQuestion: 2,
          },
        ],
      });
      jest
        .spyOn(service, 'assertBlueprint')
        .mockImplementation(() => undefined);

      await expect(service.generatePaper(bad)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when subject document is missing', async () => {
      subjectModel.findById.mockReturnValue(chainable(null));
      await expect(service.generatePaper(exam())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BANK_SHORTAGE when inventory is low', async () => {
      subjectModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(SUB_ID),
          name: 'Physics',
          topics: [],
        }),
      );
      questionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      await expect(service.generatePaper(exam())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should sample questions for a subject with topics', async () => {
      subjectModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(SUB_ID),
          name: 'Physics',
          topics: [new Types.ObjectId(TOP_ID)],
        }),
      );
      topicModel.find.mockReturnValue(
        chainable([{ _id: new Types.ObjectId(TOP_ID) }]),
      );
      questionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      questionModel.find.mockReturnValue(
        chainable([
          {
            _id: new Types.ObjectId(Q1),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'easy',
            fullMockUsageCount: 3,
            lastUsedInFullMockAt: new Date(),
          },
          {
            _id: new Types.ObjectId(Q2),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'medium',
            fullMockUsageCount: 0,
          },
        ]),
      );

      const paper = await service.generatePaper(exam());
      expect(paper.questions).toHaveLength(2);
      expect(paper.subjectNames.get(SUB_ID)).toBe('Physics');
    });

    it('should throw when generated length mismatches expected', async () => {
      subjectModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(SUB_ID),
          name: 'Physics',
          topics: [],
        }),
      );
      questionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(10),
      });
      questionModel.find.mockReturnValue(
        chainable([{ _id: new Types.ObjectId(Q1), difficultyLevel: 'easy' }]),
      );

      await expect(service.generatePaper(exam())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('allocateLargestRemainder', () => {
    it('should no-op on empty inventory', () => {
      const buckets = [{ topicId: null, inventory: 0, quota: 0, frac: 0 }];
      service.allocateLargestRemainder(buckets, 5);
      expect(buckets[0].quota).toBe(0);
    });

    it('should allocate seats and spill remainder', () => {
      const buckets = [
        { topicId: null, inventory: 3, quota: 0, frac: 0 },
        { topicId: null, inventory: 1, quota: 0, frac: 0 },
      ];
      service.allocateLargestRemainder(buckets, 4);
      expect(buckets.reduce((s, b) => s + b.quota, 0)).toBe(4);
    });
  });

  describe('weightedSample', () => {
    it('should pick without exceeding pool size', () => {
      const pool = [
        { _id: new Types.ObjectId(Q1), fullMockUsageCount: 0 },
        { _id: new Types.ObjectId(Q2), fullMockUsageCount: 8 },
      ];
      jest.spyOn(Math, 'random').mockReturnValue(0.01);
      const picked = service.weightedSample(pool, 2);
      expect(picked).toHaveLength(2);
      jest.restoreAllMocks();
    });
  });
});
