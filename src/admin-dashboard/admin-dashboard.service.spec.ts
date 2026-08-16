import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminDashboardService, formatDurationLabel } from './admin-dashboard.service';
import { User } from '../users/schemas/user.schema';
import { Question } from '../mock-test-attempts/schemas/question.schema';
import { FailedQuestion } from '../imports/schemas/failed-question.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';
import { FullMockTestDraft } from '../full-mock-tests/schemas/full-mock-test-draft.schema';
import { MockTestAttempt } from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { Exam } from '../exams/schemas/exam.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import { Topic } from '../topics/schemas/topic.schema';
import { Tag } from '../tags/schemas/tag.schema';
import { PaperType } from '../common/enums/paper-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

function createModel() {
  return {
    countDocuments: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue([]),
  };
}

describe('formatDurationLabel', () => {
  it('formats seconds as minutes and hours', () => {
    expect(formatDurationLabel(0)).toBe('0m');
    expect(formatDurationLabel(90)).toBe('1m');
    expect(formatDurationLabel(3661)).toBe('1h 1m');
  });
});

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  const userModel = createModel();
  const questionModel = createModel();
  const failedQuestionModel = createModel();
  const mockTestModel = createModel();
  const draftModel = createModel();
  const attemptModel = createModel();
  const examModel = createModel();
  const subjectModel = createModel();
  const topicModel = createModel();
  const tagModel = createModel();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Question.name), useValue: questionModel },
        {
          provide: getModelToken(FailedQuestion.name),
          useValue: failedQuestionModel,
        },
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
        { provide: getModelToken(FullMockTestDraft.name), useValue: draftModel },
        { provide: getModelToken(MockTestAttempt.name), useValue: attemptModel },
        { provide: getModelToken(Exam.name), useValue: examModel },
        { provide: getModelToken(Subject.name), useValue: subjectModel },
        { provide: getModelToken(Topic.name), useValue: topicModel },
        { provide: getModelToken(Tag.name), useValue: tagModel },
      ],
    }).compile();

    service = module.get(AdminDashboardService);
    jest.clearAllMocks();
    for (const model of [
      userModel,
      questionModel,
      failedQuestionModel,
      mockTestModel,
      draftModel,
      attemptModel,
      examModel,
      subjectModel,
      topicModel,
      tagModel,
    ]) {
      model.countDocuments.mockResolvedValue(0);
      model.aggregate.mockResolvedValue([]);
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('counts learners excluding admins and deleted users', async () => {
    userModel.countDocuments.mockResolvedValue(4);
    const summary = await service.getSummary();
    expect(summary.activeLearners).toBe(4);
    expect(userModel.countDocuments).toHaveBeenCalledWith({
      role: UserRole.USER,
      isDeleted: { $ne: true },
      isActive: true,
    });
  });

  it('counts only active non-deleted questions', async () => {
    questionModel.countDocuments.mockResolvedValue(12);
    const summary = await service.getSummary();
    expect(summary.activeQuestions).toBe(12);
    expect(questionModel.countDocuments).toHaveBeenCalledWith({
      isActive: true,
      isDeleted: { $ne: true },
    });
  });

  it('returns zeros when collections are empty', async () => {
    const summary = await service.getSummary();
    expect(summary).toEqual({
      activeLearners: 0,
      activeQuestions: 0,
      failedQuestions: 0,
      mockTests: 0,
      fullMockTests: 0,
      attempts: 0,
      exams: 0,
      subjects: 0,
      topics: 0,
      tags: 0,
    });
  });

  it('computes inactive learners from total minus active', async () => {
    userModel.countDocuments
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    userModel.aggregate.mockResolvedValue([{ _id: 'free', count: 8 }]);

    const result = await service.getUsers();
    expect(result.totalLearners).toBe(10);
    expect(result.activeLearners).toBe(7);
    expect(result.inactiveLearners).toBe(3);
    expect(result.byPlan).toEqual([{ plan: 'free', count: 8 }]);
    expect(userModel.countDocuments.mock.calls[0][0]).toEqual({
      role: UserRole.USER,
      isDeleted: { $ne: true },
    });
  });

  it('groups questions by subject and topic', async () => {
    questionModel.countDocuments.mockResolvedValue(3);
    questionModel.aggregate
      .mockResolvedValueOnce([{ _id: 'easy', count: 3 }])
      .mockResolvedValueOnce([
        {
          subjectId: 's1',
          subjectName: 'Physics',
          topicId: 't1',
          topicName: 'Optics',
          count: 3,
        },
      ]);

    const result = await service.getQuestions();
    expect(result.byDifficulty).toEqual([{ difficulty: 'easy', count: 3 }]);
    expect(result.bySubjectAndTopic[0]).toMatchObject({
      subjectName: 'Physics',
      topicName: 'Optics',
      count: 3,
    });
  });

  it('groups failed questions by stage and subject', async () => {
    failedQuestionModel.countDocuments.mockResolvedValue(2);
    failedQuestionModel.aggregate
      .mockResolvedValueOnce([{ _id: 'enrichment', count: 2 }])
      .mockResolvedValueOnce([
        { _id: 's1', count: 2, subject: { name: 'Biology' } },
      ]);

    const result = await service.getFailedQuestions();
    expect(result.byStage).toEqual([{ name: 'enrichment', count: 2 }]);
    expect(result.bySubject[0]).toMatchObject({
      name: 'Biology',
      count: 2,
    });
  });

  it('groups topic-wise mock tests by exam', async () => {
    mockTestModel.countDocuments.mockResolvedValue(5);
    mockTestModel.aggregate.mockResolvedValue([
      { _id: 'e1', count: 5, exam: { name: 'NEET' } },
    ]);

    const result = await service.getMockTests();
    expect(mockTestModel.countDocuments).toHaveBeenCalledWith({
      paperType: PaperType.TOPIC_WISE,
      isDeleted: { $ne: true },
    });
    expect(result.byExam).toEqual([{ id: 'e1', name: 'NEET', count: 5 }]);
  });

  it('includes full mock draft status counts', async () => {
    mockTestModel.countDocuments.mockResolvedValue(1);
    mockTestModel.aggregate.mockResolvedValue([
      { _id: 'e1', count: 1, exam: { name: 'NEET' } },
    ]);
    draftModel.aggregate.mockResolvedValue([{ _id: 'REVIEW', count: 4 }]);

    const result = await service.getFullMockTests();
    expect(result.totalPublished).toBe(1);
    expect(result.draftsByStatus).toEqual([{ name: 'REVIEW', count: 4 }]);
  });

  it('splits attempts into submitted, expired, and in-progress', async () => {
    attemptModel.aggregate
      .mockResolvedValueOnce([
        {
          total: 5,
          submitted: 2,
          expired: 1,
          inProgress: 2,
          uniqueUsers: ['u1', 'u2'],
          timeConsumedSeconds: 3661,
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: 'e1',
          attempts: 5,
          uniqueUsers: ['u1', 'u2'],
          submitted: 2,
          expired: 1,
          inProgress: 2,
          timeConsumedSeconds: 3661,
          allottedMinutes: 180,
          exam: { name: 'NEET' },
        },
      ]);

    const result = await service.getAttempts();
    expect(result.submitted).toBe(2);
    expect(result.expired).toBe(1);
    expect(result.inProgress).toBe(2);
    expect(result.uniqueUsers).toBe(2);
    expect(result.timeConsumedLabel).toBe('1h 1m');
    expect(result.byExam[0]).toMatchObject({
      examName: 'NEET',
      allottedMinutes: 180,
      timeConsumedLabel: '1h 1m',
    });
  });

  it('returns empty attempt totals when there are no documents', async () => {
    const result = await service.getAttempts();
    expect(result.total).toBe(0);
    expect(result.timeConsumedLabel).toBe('0m');
    expect(result.byExam).toEqual([]);
  });

  it('groups exams by category', async () => {
    examModel.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    examModel.aggregate.mockResolvedValue([
      { _id: 'c1', count: 3, category: { name: 'Medical' } },
    ]);

    const result = await service.getExams();
    expect(result.totalActive).toBe(3);
    expect(result.totalInactive).toBe(1);
    expect(result.byCategory[0]).toMatchObject({ name: 'Medical', count: 3 });
  });

  it('returns subjects with topic counts', async () => {
    subjectModel.countDocuments.mockResolvedValue(1);
    subjectModel.aggregate.mockResolvedValue([
      { _id: 's1', name: 'Physics', isActive: true, topicCount: 4 },
    ]);

    const result = await service.getSubjects();
    expect(result.rows[0]).toEqual({
      id: 's1',
      name: 'Physics',
      topicCount: 4,
      isActive: true,
    });
  });

  it('groups topics via subject unwind', async () => {
    topicModel.countDocuments.mockResolvedValue(1);
    subjectModel.aggregate.mockResolvedValue([
      {
        id: 't1',
        name: 'Optics',
        subjectId: 's1',
        subjectName: 'Physics',
      },
    ]);

    const result = await service.getTopics();
    expect(result.rows[0].subjectName).toBe('Physics');
  });

  it('looks up tag subject names', async () => {
    tagModel.countDocuments.mockResolvedValue(1);
    tagModel.aggregate.mockResolvedValue([
      {
        _id: 'tag1',
        name: 'formula',
        subject: 's1',
        subjectDoc: { name: 'Physics' },
        topicDoc: { name: 'Optics' },
      },
    ]);

    const result = await service.getTags();
    expect(result.rows[0]).toMatchObject({
      name: 'formula',
      subjectName: 'Physics',
      topicName: 'Optics',
    });
  });
});
