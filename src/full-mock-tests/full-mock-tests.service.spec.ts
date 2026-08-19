import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FullMockTestsService } from './full-mock-tests.service';
import { Exam } from '../exams/schemas/exam.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import { Question } from '../mock-test-attempts/schemas/question.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';
import { FullMockTestDraft } from './schemas/full-mock-test-draft.schema';
import { FullMockSelectionService } from './full-mock-selection.service';
import { MockTestsService } from '../mock-tests/mock-tests.service';
import { ImageUrlResolver } from '../aws/s3/image-url.resolver';
import { UserAttemptAction } from '../common/enums/user-attempt-action.enum';

const EXAM_ID = '507f1f77bcf86cd799439011';
const SUB_ID = '507f1f77bcf86cd799439012';
const Q1 = '507f1f77bcf86cd799439013';
const Q2 = '507f1f77bcf86cd799439014';
const DRAFT_ID = '507f1f77bcf86cd799439015';
const USER_ID = '507f1f77bcf86cd799439016';
const TEST_ID = '507f1f77bcf86cd799439017';
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

function makeExam() {
  return {
    _id: new Types.ObjectId(EXAM_ID),
    name: 'CGL',
    description: 'tier',
    duration: 60,
    totalQuestions: 1,
    totalMarks: 2,
    isSessionWise: false,
    isActive: true,
    category: { name: 'SSC' },
    examGroup: { name: 'CGL' },
    subjects: [
      {
        subject: new Types.ObjectId(SUB_ID),
        numberOfQuestions: 1,
        marksPerQuestion: 2,
        hasNegativeMarking: true,
        negativeMarksPerQuestion: 0.5,
        sessionTime: 30,
        name: 'GS',
      },
    ],
  };
}

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(DRAFT_ID),
    id: DRAFT_ID,
    exam: new Types.ObjectId(EXAM_ID),
    status: 'REVIEW',
    examSnapshot: {
      name: 'CGL',
      description: 'd',
      duration: 60,
      totalQuestions: 1,
      totalMarks: 2,
      isSessionWise: false,
      subjects: [
        {
          subject: new Types.ObjectId(SUB_ID),
          name: 'GS',
          numberOfQuestions: 1,
          marksPerQuestion: 2,
          hasNegativeMarking: true,
          negativeMarksPerQuestion: 0.5,
          sessionTime: 30,
        },
      ],
    },
    questions: [
      {
        question: new Types.ObjectId(Q1),
        subject: new Types.ObjectId(SUB_ID),
        topic: new Types.ObjectId(TOP_ID),
        difficultyLevel: 'easy',
        position: 0,
        marksPerQuestion: 2,
        negativeMarking: 0.5,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function questionLean(id = Q1) {
  return {
    _id: { toString: () => id },
    questionText: { en: { text: 'Hello world' }, ml: { text: null } },
    optionType: 'text',
    options: [{ id: 'a', type: 'text', en: 'A', ml: null }],
    subject: { toString: () => SUB_ID },
    topic: { toString: () => TOP_ID },
    difficultyLevel: 'easy',
    isActive: true,
  };
}

describe('FullMockTestsService', () => {
  let service: FullMockTestsService;
  const examModel: any = {
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
  };
  const subjectModel: any = { find: jest.fn() };
  const questionModel: any = {
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  };
  const mockTestModel: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  };
  const draftModel: any = {
    create: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const selectionService = { generatePaper: jest.fn() };
  const mockTestsService = { getUserAttemptActions: jest.fn() };
  const imageUrlResolver = {
    resolveMany: jest.fn().mockResolvedValue([null, null, null]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FullMockTestsService,
        { provide: getModelToken(Exam.name), useValue: examModel },
        { provide: getModelToken(Subject.name), useValue: subjectModel },
        { provide: getModelToken(Question.name), useValue: questionModel },
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
        {
          provide: getModelToken(FullMockTestDraft.name),
          useValue: draftModel,
        },
        { provide: FullMockSelectionService, useValue: selectionService },
        { provide: MockTestsService, useValue: mockTestsService },
        { provide: ImageUrlResolver, useValue: imageUrlResolver },
      ],
    }).compile();

    service = module.get(FullMockTestsService);
    jest.clearAllMocks();
    examModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });
    mockTestModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });
    questionModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });
    draftModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
    imageUrlResolver.resolveMany.mockResolvedValue([null, null, null]);
  });

  describe('listExamsForAdmin', () => {
    it('should list exams with subject names and search', async () => {
      const exam = makeExam();
      examModel.find.mockReturnValue(chainable([exam]));
      subjectModel.find.mockReturnValue(
        chainable([{ _id: { toString: () => SUB_ID }, name: 'GS' }]),
      );

      const result = await service.listExamsForAdmin(1, 10, 'CGL');
      expect(result.data[0].examName).toBe('CGL');
      expect(result.data[0].mode).toBe('Mixed');
      expect(result.data[0].subjects).toEqual(['GS']);
    });

    it('should skip subject lookup when none present', async () => {
      examModel.find.mockReturnValue(
        chainable([
          {
            ...makeExam(),
            subjects: [],
            duration: undefined,
            isSessionWise: true,
            examGroup: undefined,
          },
        ]),
      );

      const result = await service.listExamsForAdmin(0, 200);
      expect(result.pagination.limit).toBe(100);
      expect(result.data[0].mode).toBe('Session-wise');
      expect(subjectModel.find).not.toHaveBeenCalled();
    });

    it('uses default pagination arguments', async () => {
      examModel.find.mockReturnValue(chainable([]));
      const result = await service.listExamsForAdmin();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('createDraft / getDraft', () => {
    it('should reject invalid exam ids and inactive exams', async () => {
      await expect(
        service.createDraft({ examId: 'bad' }, USER_ID),
      ).rejects.toThrow(BadRequestException);

      examModel.findById.mockReturnValue(chainable({ isActive: false }));
      await expect(
        service.createDraft({ examId: EXAM_ID }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a draft from generated paper', async () => {
      examModel.findById.mockReturnValue(chainable(makeExam()));
      selectionService.generatePaper.mockResolvedValue({
        questions: makeDraft().questions,
        subjectNames: new Map([[SUB_ID, 'GS']]),
      });
      const draft = makeDraft();
      draftModel.create.mockResolvedValue(draft);
      questionModel.find.mockReturnValue(chainable([questionLean()]));

      const result = await service.createDraft({ examId: EXAM_ID }, USER_ID);
      expect(result.id).toBe(DRAFT_ID);
      expect(result.subjects[0].questions[0]._id).toBe(Q1);
    });

    it('should persist generated questions in exam subject order', async () => {
      const sub2 = '507f1f77bcf86cd799439019';
      const exam = {
        ...makeExam(),
        totalQuestions: 2,
        subjects: [
          ...makeExam().subjects,
          {
            subject: new Types.ObjectId(sub2),
            numberOfQuestions: 1,
            marksPerQuestion: 1,
            hasNegativeMarking: false,
            negativeMarksPerQuestion: 0,
            sessionTime: 15,
            name: 'Math',
          },
        ],
      };
      examModel.findById.mockReturnValue(chainable(exam));
      selectionService.generatePaper.mockResolvedValue({
        questions: [
          {
            question: new Types.ObjectId(Q2),
            subject: new Types.ObjectId(sub2),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'easy',
            position: 0,
            marksPerQuestion: 1,
            negativeMarking: 0,
          },
          {
            question: new Types.ObjectId(Q1),
            subject: new Types.ObjectId(SUB_ID),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'easy',
            position: 1,
            marksPerQuestion: 2,
            negativeMarking: 0.5,
          },
        ],
        subjectNames: new Map([
          [SUB_ID, 'GS'],
          [sub2, 'Math'],
        ]),
      });
      draftModel.create.mockResolvedValue(makeDraft());
      questionModel.find.mockReturnValue(chainable([questionLean()]));

      await service.createDraft({ examId: EXAM_ID }, USER_ID);

      const stored = draftModel.create.mock.calls[0][0].questions;
      expect(
        stored.map((q: { question: Types.ObjectId }) => q.question.toString()),
      ).toEqual([Q1, Q2]);
      expect(stored[0].position).toBe(0);
      expect(stored[1].position).toBe(1);
    });

    it('should load a draft', async () => {
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      questionModel.find.mockReturnValue(chainable([]));
      const result = await service.getDraft(DRAFT_ID);
      expect(result.status).toBe('REVIEW');
    });

    it('uses placeholder questions when documents are missing', async () => {
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      questionModel.find.mockReturnValue(chainable([]));
      const result = await service.getDraft(DRAFT_ID);
      expect(result.subjects[0].questions[0]._id).toBe(Q1);
      expect(result.subjects[0].questions[0].options).toEqual([]);
    });

    it('should 404 discarded drafts', async () => {
      draftModel.findById.mockReturnValue(
        chainable(makeDraft({ status: 'DISCARDED' })),
      );
      await expect(service.getDraft(DRAFT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('searchQuestions', () => {
    it('should validate ids', async () => {
      await expect(service.searchQuestions({ subjectId: 'x' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.searchQuestions({ subjectId: SUB_ID, topicId: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should search with filters and exclude draft questions', async () => {
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      questionModel.find.mockReturnValue(chainable([questionLean()]));

      const result = await service.searchQuestions({
        subjectId: SUB_ID,
        draftId: DRAFT_ID,
        search: 'Hello',
        topicId: TOP_ID,
        difficultyLevel: 'easy',
        page: 1,
        limit: 20,
      });
      expect(result.data[0].snippet).toBe('Hello world');
      const query = questionModel.find.mock.calls[0][0];
      expect(query.subject.toString()).toBe(SUB_ID);
      expect(query.exams.toString()).toBe(EXAM_ID);
      expect(query.topic.toString()).toBe(TOP_ID);
      expect(query.difficultyLevel).toBe('easy');
      expect(query._id.$nin.map((id: Types.ObjectId) => id.toString())).toEqual(
        [Q1],
      );
    });

    it('should not filter by exam when draftId is omitted', async () => {
      questionModel.find.mockReturnValue(chainable([questionLean()]));

      await service.searchQuestions({ subjectId: SUB_ID });

      expect(questionModel.find).toHaveBeenCalledWith(
        expect.not.objectContaining({ exams: expect.anything() }),
      );
      expect(questionModel.find.mock.calls[0][0].exams).toBeUndefined();
    });

    it('should require draftId when allowCrossSubject is true', async () => {
      await expect(
        service.searchQuestions({ allowCrossSubject: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should search all exam-tagged questions when allowCrossSubject omits subjectId', async () => {
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      questionModel.find.mockReturnValue(chainable([questionLean()]));

      await service.searchQuestions({
        draftId: DRAFT_ID,
        allowCrossSubject: true,
      });

      const query = questionModel.find.mock.calls[0][0];
      expect(query.exams.toString()).toBe(EXAM_ID);
      expect(query.subject).toBeUndefined();
    });
  });

  describe('replaceQuestion', () => {
    it('should reject non-review drafts and missing slots', async () => {
      draftModel.findById.mockReturnValue(
        chainable(makeDraft({ status: 'PUBLISHED' })),
      );
      await expect(service.replaceQuestion(DRAFT_ID, 0, Q2)).rejects.toThrow(
        BadRequestException,
      );

      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      await expect(service.replaceQuestion(DRAFT_ID, 9, Q2)).rejects.toThrow(
        /No question at position/,
      );
    });

    it('should reject ineligible, mismatched, and duplicate questions', async () => {
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      await expect(service.replaceQuestion(DRAFT_ID, 0, 'bad')).rejects.toThrow(
        BadRequestException,
      );

      questionModel.findById.mockReturnValue(chainable(null));
      await expect(service.replaceQuestion(DRAFT_ID, 0, Q2)).rejects.toThrow(
        BadRequestException,
      );

      questionModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(Q2),
          isActive: true,
          difficultyLevel: 'easy',
          subject: new Types.ObjectId(EXAM_ID),
        }),
      );
      await expect(service.replaceQuestion(DRAFT_ID, 0, Q2)).rejects.toThrow(
        BadRequestException,
      );

      questionModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(Q1),
          isActive: true,
          difficultyLevel: 'easy',
          subject: new Types.ObjectId(SUB_ID),
          topic: new Types.ObjectId(TOP_ID),
          exams: [new Types.ObjectId(EXAM_ID)],
        }),
      );
      const withDup = makeDraft({
        questions: [
          {
            question: new Types.ObjectId(Q1),
            subject: new Types.ObjectId(SUB_ID),
            position: 0,
          },
          {
            question: new Types.ObjectId(Q2),
            subject: new Types.ObjectId(SUB_ID),
            position: 1,
          },
        ],
      });
      draftModel.findById.mockReturnValue(chainable(withDup));
      await expect(service.replaceQuestion(DRAFT_ID, 1, Q1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject questions that are not tagged to the draft exam', async () => {
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      questionModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(Q2),
          isActive: true,
          difficultyLevel: 'easy',
          subject: new Types.ObjectId(SUB_ID),
          topic: new Types.ObjectId(TOP_ID),
          exams: [new Types.ObjectId(Q2)],
        }),
      );

      await expect(service.replaceQuestion(DRAFT_ID, 0, Q2)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.replaceQuestion(DRAFT_ID, 0, Q2);
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          error: 'EXAM_MISMATCH',
        });
      }
    });

    it('should replace a question', async () => {
      const draft = makeDraft();
      draftModel.findById.mockReturnValue(chainable(draft));
      questionModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(Q2),
          isActive: true,
          difficultyLevel: 'hard',
          subject: new Types.ObjectId(SUB_ID),
          topic: new Types.ObjectId(TOP_ID),
          exams: [new Types.ObjectId(EXAM_ID)],
        }),
      );
      questionModel.find.mockReturnValue(chainable([questionLean(Q2)]));

      const result = await service.replaceQuestion(DRAFT_ID, 0, Q2);
      expect(draft.save).toHaveBeenCalled();
      expect(result.id).toBe(DRAFT_ID);
    });

    it('should reject a different subject unless allowCrossSubject is set', async () => {
      const otherSubject = '507f1f77bcf86cd799439099';
      draftModel.findById.mockReturnValue(chainable(makeDraft()));
      questionModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(Q2),
          isActive: true,
          difficultyLevel: 'easy',
          subject: new Types.ObjectId(otherSubject),
          topic: new Types.ObjectId(TOP_ID),
          exams: [new Types.ObjectId(EXAM_ID)],
        }),
      );

      await expect(service.replaceQuestion(DRAFT_ID, 0, Q2)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.replaceQuestion(DRAFT_ID, 0, Q2);
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          error: 'SUBJECT_MISMATCH',
        });
      }
    });

    it('should replace a cross-subject question without changing the slot subject', async () => {
      const otherSubject = '507f1f77bcf86cd799439099';
      const draft = makeDraft();
      const originalSubject = draft.questions[0].subject.toString();
      draftModel.findById.mockReturnValue(chainable(draft));
      questionModel.findById.mockReturnValue(
        chainable({
          _id: new Types.ObjectId(Q2),
          isActive: true,
          difficultyLevel: 'medium',
          subject: new Types.ObjectId(otherSubject),
          topic: new Types.ObjectId(TOP_ID),
          exams: [new Types.ObjectId(EXAM_ID)],
        }),
      );
      questionModel.find.mockReturnValue(chainable([questionLean(Q2)]));

      await service.replaceQuestion(DRAFT_ID, 0, Q2, true);
      expect(draft.save).toHaveBeenCalled();
      expect(draft.questions[0].subject.toString()).toBe(originalSubject);
      expect(draft.questions[0].question.toString()).toBe(Q2);
    });
  });

  describe('publishDraft', () => {
    it('should reject invalid ids and non-review drafts', async () => {
      await expect(service.publishDraft('bad', {}, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      draftModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.publishDraft(DRAFT_ID, {}, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should roll back status when finalize fails', async () => {
      const draft = makeDraft({
        examSnapshot: {
          ...makeDraft().examSnapshot,
          totalQuestions: 9,
        },
      });
      draftModel.findOneAndUpdate.mockResolvedValue(draft);

      await expect(service.publishDraft(DRAFT_ID, {}, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(draftModel.updateOne).toHaveBeenCalled();
    });

    it('should publish a complete paper', async () => {
      const draft = makeDraft();
      draftModel.findOneAndUpdate.mockResolvedValue(draft);
      questionModel.find.mockReturnValue(
        chainable([{ _id: { toString: () => Q1 } }]),
      );
      mockTestModel.create.mockResolvedValue({
        id: TEST_ID,
        _id: new Types.ObjectId(TEST_ID),
      });
      questionModel.updateMany.mockResolvedValue({});
      questionModel.find.mockReturnValue(chainable([questionLean()]));

      const result = await service.publishDraft(
        DRAFT_ID,
        { title: 'Paper 1', passingScore: 1 },
        USER_ID,
      );
      expect(result.mockTestId).toBe(TEST_ID);
      expect(draft.status).toBe('PUBLISHED');
    });

    it('should regroup interleaved questions into contiguous subject blocks', async () => {
      const sub2 = '507f1f77bcf86cd799439019';
      const draft = makeDraft({
        examSnapshot: {
          name: 'CGL',
          description: 'd',
          duration: 60,
          totalQuestions: 2,
          totalMarks: 3,
          isSessionWise: true,
          subjects: [
            {
              subject: new Types.ObjectId(SUB_ID),
              name: 'GS',
              numberOfQuestions: 1,
              marksPerQuestion: 2,
              hasNegativeMarking: true,
              negativeMarksPerQuestion: 0.5,
              sessionTime: 15,
            },
            {
              subject: new Types.ObjectId(sub2),
              name: 'Math',
              numberOfQuestions: 1,
              marksPerQuestion: 1,
              hasNegativeMarking: false,
              negativeMarksPerQuestion: 0,
              sessionTime: 15,
            },
          ],
        },
        questions: [
          {
            question: new Types.ObjectId(Q2),
            subject: new Types.ObjectId(sub2),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'easy',
            position: 0,
            marksPerQuestion: 1,
            negativeMarking: 0,
          },
          {
            question: new Types.ObjectId(Q1),
            subject: new Types.ObjectId(SUB_ID),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'easy',
            position: 1,
            marksPerQuestion: 2,
            negativeMarking: 0.5,
          },
        ],
      });
      draftModel.findOneAndUpdate.mockResolvedValue(draft);
      questionModel.find.mockReturnValue(
        chainable([questionLean(Q1), questionLean(Q2)]),
      );
      mockTestModel.create.mockResolvedValue({
        id: TEST_ID,
        _id: new Types.ObjectId(TEST_ID),
      });
      questionModel.updateMany.mockResolvedValue({});

      await service.publishDraft(DRAFT_ID, { title: 'Paper 1' }, USER_ID);

      const payload = mockTestModel.create.mock.calls[0][0];
      expect(
        payload.questionIds.map((id: Types.ObjectId) => id.toString()),
      ).toEqual([Q1, Q2]);
      expect(payload.subjectConfig[0].questionStartIndex).toBe(0);
      expect(payload.subjectConfig[0].questionEndIndex).toBe(0);
      expect(payload.subjectConfig[1].questionStartIndex).toBe(1);
      expect(payload.subjectConfig[1].questionEndIndex).toBe(1);
      expect(
        payload.subjectConfig[0].questionIds.map((id: Types.ObjectId) =>
          id.toString(),
        ),
      ).toEqual([Q1]);
      expect(
        payload.subjectConfig[1].questionIds.map((id: Types.ObjectId) =>
          id.toString(),
        ),
      ).toEqual([Q2]);
    });

    it('should keep question ids when grouping mongoose-like subdocuments', async () => {
      const asSubdoc = (plain: Record<string, unknown>) => {
        const doc: Record<string, unknown> = {};
        Object.defineProperties(doc, {
          question: { value: plain.question, enumerable: false },
          subject: { value: plain.subject, enumerable: false },
          topic: { value: plain.topic, enumerable: false },
          difficultyLevel: { value: plain.difficultyLevel, enumerable: false },
          position: { value: plain.position, enumerable: false },
          marksPerQuestion: {
            value: plain.marksPerQuestion,
            enumerable: false,
          },
          negativeMarking: { value: plain.negativeMarking, enumerable: false },
        });
        return doc;
      };
      const draft = makeDraft({
        questions: [
          asSubdoc({
            question: new Types.ObjectId(Q1),
            subject: new Types.ObjectId(SUB_ID),
            topic: new Types.ObjectId(TOP_ID),
            difficultyLevel: 'easy',
            position: 0,
            marksPerQuestion: 2,
            negativeMarking: 0.5,
          }),
        ],
      });
      draftModel.findOneAndUpdate.mockResolvedValue(draft);
      questionModel.find.mockReturnValue(chainable([questionLean(Q1)]));
      mockTestModel.create.mockResolvedValue({
        id: TEST_ID,
        _id: new Types.ObjectId(TEST_ID),
      });
      questionModel.updateMany.mockResolvedValue({});

      const result = await service.publishDraft(DRAFT_ID, {}, USER_ID);
      expect(result.mockTestId).toBe(TEST_ID);
      const payload = mockTestModel.create.mock.calls[0][0];
      expect(
        payload.questionIds.map((id: Types.ObjectId) => id.toString()),
      ).toEqual([Q1]);
    });

    it('should reject ineligible questions', async () => {
      const draft = makeDraft();
      draftModel.findOneAndUpdate.mockResolvedValue(draft);
      questionModel.find.mockReturnValue(chainable([]));

      await expect(service.publishDraft(DRAFT_ID, {}, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an empty question list', async () => {
      const draft = makeDraft({ questions: [] });
      draftModel.findOneAndUpdate.mockResolvedValue(draft);
      await expect(service.publishDraft(DRAFT_ID, {}, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('discardDraft', () => {
    it('should discard review drafts only', async () => {
      const draft = makeDraft();
      draftModel.findById.mockReturnValue(chainable(draft));
      await service.discardDraft(DRAFT_ID);
      expect(draft.status).toBe('DISCARDED');

      draftModel.findById.mockReturnValue(
        chainable(makeDraft({ status: 'PUBLISHED' })),
      );
      await expect(service.discardDraft(DRAFT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listPublished / findOnePublished', () => {
    const published = {
      id: TEST_ID,
      _id: { toString: () => TEST_ID },
      title: 'Full',
      description: 'd',
      totalQuestions: 1,
      durationInMinutes: 60,
      totalMarks: 2,
      isSessionWise: false,
      exam: {
        _id: { toString: () => EXAM_ID },
        name: 'CGL',
        description: 'd',
        toString: () => EXAM_ID,
      },
      subjectConfig: [
        {
          subject: { toString: () => SUB_ID },
          name: 'GS',
          numberOfQuestions: 1,
          marksPerQuestion: 2,
          hasNegativeMarking: true,
          negativeMarksPerQuestion: 0.5,
          sessionTime: 30,
          questionStartIndex: 0,
          questionEndIndex: 0,
        },
      ],
      marksPerQuestion: 2,
      negativeMarking: 0.5,
      passingScore: 1,
      allowRetake: true,
      shuffleOptions: false,
      showResultsImmediately: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should reject invalid exam ids and list papers', async () => {
      await expect(service.listPublished('bad')).rejects.toThrow(
        BadRequestException,
      );
      mockTestModel.find.mockReturnValue(chainable([published]));
      mockTestsService.getUserAttemptActions.mockResolvedValue(
        new Map([
          [
            TEST_ID,
            { action: UserAttemptAction.RESUME, resumeAttemptId: 'a1' },
          ],
        ]),
      );

      const result = await service.listPublished(
        EXAM_ID,
        1,
        10,
        USER_ID,
        false,
      );
      expect(result.data[0].userAttemptAction).toBe(UserAttemptAction.RESUME);
    });

    it('should find one published paper', async () => {
      await expect(service.findOnePublished('bad')).rejects.toThrow(
        BadRequestException,
      );
      mockTestModel.findOne.mockReturnValue(chainable(null));
      await expect(service.findOnePublished(TEST_ID)).rejects.toThrow(
        NotFoundException,
      );

      mockTestModel.findOne.mockReturnValue(chainable(published));
      mockTestsService.getUserAttemptActions.mockResolvedValue(new Map());
      const result = await service.findOnePublished(TEST_ID, USER_ID);
      expect(result.id).toBe(TEST_ID);
    });

    it('lists and loads papers without a user id', async () => {
      mockTestModel.find.mockReturnValue(chainable([published]));
      const listed = await service.listPublished(undefined);
      expect(listed.data[0].userAttemptAction).toBe(UserAttemptAction.START);
      expect(mockTestsService.getUserAttemptActions).not.toHaveBeenCalled();

      mockTestModel.findOne.mockReturnValue(chainable(published));
      const one = await service.findOnePublished(TEST_ID);
      expect(one.id).toBe(TEST_ID);
    });
  });
});
