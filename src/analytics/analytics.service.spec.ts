import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Types } from 'mongoose';
import { AnalyticsService } from './analytics.service';
import { MockTestAttempt } from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { Question } from '../mock-test-attempts/schemas/question.schema';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { MembershipTier } from '../common/enums/membership-tier.enum';

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const SUB_ID = '507f1f77bcf86cd799439013';
const EXAM_ID = '507f1f77bcf86cd799439014';
const TOP_ID = '507f1f77bcf86cd799439015';
const ATTEMPT_ID = '507f1f77bcf86cd799439016';

function oid(id: string) {
  return new Types.ObjectId(id);
}

function dashboardRaw(overrides: Record<string, unknown> = {}) {
  return {
    summary: [
      {
        totalAttempts: 12,
        completedAttempts: 10,
        totalTimeConsumed: 3600,
        averageScorePercent: 72,
        bestScorePercent: 100,
      },
    ],
    streakDates: [],
    accuracy: [{ totalCorrect: 80, totalAnswered: 100, totalUnanswered: 5 }],
    subjectPerformance: [
      {
        _id: oid(SUB_ID),
        subjectName: 'Physics',
        attemptCount: 6,
        averageScorePercent: 90,
      },
    ],
    examPerformance: [
      {
        _id: oid(EXAM_ID),
        examName: 'NEET',
        attemptCount: 4,
        averageScorePercent: 70,
      },
    ],
    ...overrides,
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const attemptModel: any = {
    aggregate: jest.fn(),
    findOne: jest.fn(),
  };
  const questionModel: any = {};
  const userModel: any = {};
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const usersService = { updateMembershipTier: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getModelToken(MockTestAttempt.name),
          useValue: attemptModel,
        },
        { provide: getModelToken(Question.name), useValue: questionModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    jest.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    cache.set.mockResolvedValue(undefined);
    cache.del.mockResolvedValue(undefined);
    usersService.updateMembershipTier.mockResolvedValue(undefined);
  });

  describe('getDashboard', () => {
    it('should return cached dashboard', async () => {
      cache.get.mockResolvedValue({ streak: { currentStreak: 1 } });
      const result = await service.getDashboard(USER_ID);
      expect(result.streak.currentStreak).toBe(1);
      expect(attemptModel.aggregate).not.toHaveBeenCalled();
    });

    it('should build dashboard from aggregation including empty facets', async () => {
      attemptModel.aggregate.mockResolvedValue([
        {
          summary: [],
          streakDates: [],
          accuracy: [],
          subjectPerformance: [],
          examPerformance: [],
        },
      ]);

      const result = await service.getDashboard(USER_ID);
      expect(result.testsSummary.attempted).toBe(0);
      expect(result.accuracy.accuracyPercent).toBe(0);
      expect(result.streak.currentStreak).toBe(0);
    });

    it('should compute streak from today and consecutive dates', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = (offset: number) => {
        const x = new Date(today);
        x.setDate(today.getDate() - offset);
        return x.toISOString().slice(0, 10);
      };
      attemptModel.aggregate.mockResolvedValue([
        dashboardRaw({
          streakDates: [
            { dateStr: d(0) },
            { dateStr: d(1) },
            { dateStr: d(2) },
            { dateStr: d(10) },
          ],
        }),
      ]);

      const result = await service.getDashboard(USER_ID);
      expect(result.streak.currentStreak).toBe(3);
      expect(result.streak.longestStreak).toBeGreaterThanOrEqual(3);
      expect(result.testsSummary.completionRate).toBe(83.33);
    });
  });

  describe('getLeaderboard', () => {
    it('should return cached leaderboard', async () => {
      cache.get.mockResolvedValue({
        data: [],
        pagination: {},
        currentUserRank: {},
      });
      await service.getLeaderboard(USER_ID, 1, 10);
      expect(attemptModel.aggregate).not.toHaveBeenCalled();
    });

    it('should rank users, apply filters, and locate current user off-page', async () => {
      attemptModel.aggregate.mockResolvedValue([
        {
          userId: oid(OTHER_ID),
          userName: 'A',
          averageScorePercent: 90,
          totalAttempts: 5,
          totalCorrect: 40,
        },
        {
          userId: oid(USER_ID),
          userName: 'Me',
          averageScorePercent: 80,
          totalAttempts: 4,
          totalCorrect: 30,
        },
      ]);

      const result = await service.getLeaderboard(
        USER_ID,
        1,
        1,
        EXAM_ID,
        SUB_ID,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].isCurrentUser).toBe(false);
      expect(result.currentUserRank.rank).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });

  describe('getRecentActivity', () => {
    it('should return cached activity', async () => {
      cache.get.mockResolvedValue([]);
      await service.getRecentActivity(USER_ID, 10);
      expect(attemptModel.aggregate).not.toHaveBeenCalled();
    });

    it('should map activity with and without related docs', async () => {
      attemptModel.aggregate.mockResolvedValue([
        {
          _id: oid(ATTEMPT_ID),
          testTitle: 'T',
          score: 8,
          totalQuestions: 10,
          marksPerQuestion: 1,
          negativeMarking: 0,
          timeConsumed: 120,
          submittedAt: new Date('2024-01-01'),
          status: 'SUBMITTED',
          questions: [
            { isCorrect: true, selectedOption: 'a' },
            { isCorrect: false, selectedOption: 'b' },
            { isCorrect: false, selectedOption: null },
          ],
          subjectId: oid(SUB_ID),
          subjectName: 'Physics',
          subjectDescription: 's',
          examId: oid(EXAM_ID),
          examName: 'NEET',
          examDescription: 'e',
          topicId: oid(TOP_ID),
          topicName: 'Optics',
          topicDescription: 't',
        },
        {
          _id: oid(OTHER_ID),
          testTitle: 'Empty',
          score: 0,
          totalQuestions: 0,
          marksPerQuestion: 1,
          timeConsumed: 0,
          submittedAt: new Date('2024-01-02'),
          status: 'EXPIRED',
          questions: [],
          subjectId: null,
          examId: null,
          topicId: null,
        },
      ]);

      const result = await service.getRecentActivity(USER_ID, 99);
      expect(result[0].correctAnswers).toBe(1);
      expect(result[0].subject?.name).toBe('Physics');
      expect(result[1].scorePercent).toBe(0);
      expect(result[1].subject).toBeNull();
    });
  });

  describe('getSubjectTopicBreakdown', () => {
    it('should return cached breakdown', async () => {
      cache.get.mockResolvedValue({ subjects: [] });
      await service.getSubjectTopicBreakdown(USER_ID);
      expect(attemptModel.aggregate).not.toHaveBeenCalled();
    });

    it('should group topics and compute trends / strength', async () => {
      attemptModel.aggregate
        .mockResolvedValueOnce([
          {
            subjectId: oid(SUB_ID),
            subjectName: 'Physics',
            topicId: oid(TOP_ID),
            topicName: 'Optics',
            totalQuestions: 10,
            totalCorrect: 8,
            totalAnswered: 10,
          },
          {
            subjectId: oid(SUB_ID),
            subjectName: 'Physics',
            topicId: oid(EXAM_ID),
            topicName: 'Weak',
            totalQuestions: 5,
            totalCorrect: 1,
            totalAnswered: 5,
          },
          {
            subjectId: oid(SUB_ID),
            subjectName: 'Physics',
            topicId: null,
            topicName: 'General',
            totalQuestions: 1,
            totalCorrect: 0,
            totalAnswered: 0,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: oid(SUB_ID),
            scores: [90, 88, 70, 40, 30, 20, 10],
          },
        ]);

      const result = await service.getSubjectTopicBreakdown(USER_ID);
      expect(result.subjects[0].strengthLabel).toBeDefined();
      expect(result.subjects[0].topics.some(t => t.isWeak)).toBe(true);
      expect(result.subjects[0].trend).toBe('improving');
    });

    it('returns stable, declining, and insufficient trends', async () => {
      attemptModel.aggregate
        .mockResolvedValueOnce([
          {
            subjectId: oid(SUB_ID),
            subjectName: 'Physics',
            topicId: oid(TOP_ID),
            topicName: 'Optics',
            totalQuestions: 10,
            totalCorrect: 5,
            totalAnswered: 10,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: oid(SUB_ID),
            scores: [50, 50, 50, 50, 50],
          },
        ]);
      expect(
        (await service.getSubjectTopicBreakdown(USER_ID)).subjects[0].trend,
      ).toBe('stable');

      attemptModel.aggregate
        .mockResolvedValueOnce([
          {
            subjectId: oid(SUB_ID),
            subjectName: 'Physics',
            topicId: oid(TOP_ID),
            topicName: 'Optics',
            totalQuestions: 10,
            totalCorrect: 5,
            totalAnswered: 10,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: oid(SUB_ID),
            scores: [10, 10, 10, 10, 10, 90, 90, 90, 90, 90],
          },
        ]);
      expect(
        (await service.getSubjectTopicBreakdown(USER_ID)).subjects[0].trend,
      ).toBe('declining');

      attemptModel.aggregate
        .mockResolvedValueOnce([
          {
            subjectId: oid(SUB_ID),
            subjectName: 'Physics',
            topicId: oid(TOP_ID),
            topicName: 'Optics',
            totalQuestions: 2,
            totalCorrect: 1,
            totalAnswered: 2,
          },
        ])
        .mockResolvedValueOnce([{ _id: oid(SUB_ID), scores: [40] }]);
      expect(
        (await service.getSubjectTopicBreakdown(USER_ID)).subjects[0].trend,
      ).toBe('insufficient-data');
    });
  });

  describe('getUserBadges', () => {
    it('should return cached badges', async () => {
      cache.get.mockResolvedValue({
        badges: [],
        earnedCount: 0,
        totalCount: 0,
      });
      await service.getUserBadges(USER_ID);
      expect(attemptModel.aggregate).not.toHaveBeenCalled();
    });

    it('should evaluate catalog badges and update membership', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 30 }, (_, i) => {
        const x = new Date(today);
        x.setDate(today.getDate() - i);
        return { dateStr: x.toISOString().slice(0, 10) };
      });
      cache.get.mockImplementation(async (key: string) => {
        if (key.startsWith('analytics:badges')) return undefined;
        return undefined;
      });
      attemptModel.aggregate.mockResolvedValue([
        dashboardRaw({ streakDates: dates }),
      ]);
      attemptModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: oid(ATTEMPT_ID) }),
          }),
        }),
      });

      const result = await service.getUserBadges(USER_ID);
      const earned = result.badges.filter(b => b.isEarned).map(b => b.id);
      expect(earned).toEqual(
        expect.arrayContaining([
          'first-test',
          'tests-10',
          'top-scorer',
          'perfect-score',
          'speed-demon',
          'accuracy-master',
          'subject-expert',
          'streak-7',
          'streak-30',
        ]),
      );
      await Promise.resolve();
      expect(usersService.updateMembershipTier).toHaveBeenCalledWith(
        USER_ID,
        MembershipTier.GOLD,
        expect.any(Number),
      );
    });

    it('swallows membership update failures and maps empty badges to NONE', async () => {
      usersService.updateMembershipTier.mockRejectedValue(new Error('db'));
      attemptModel.aggregate.mockResolvedValue([
        dashboardRaw({
          summary: [
            {
              totalAttempts: 0,
              completedAttempts: 0,
              totalTimeConsumed: 0,
              averageScorePercent: 0,
              bestScorePercent: 0,
            },
          ],
          subjectPerformance: [],
        }),
      ]);
      attemptModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const result = await service.getUserBadges(USER_ID);
      expect(result.earnedCount).toBe(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    it('maps remaining membership tiers from earned counts', () => {
      const svc = service as unknown as {
        deriveMembershipTier: (n: number) => MembershipTier;
        evaluateBadge: (
          id: string,
          dashboard: unknown,
          speed: boolean,
        ) => boolean;
      };
      expect(svc.deriveMembershipTier(10)).toBe(MembershipTier.PLATINUM);
      expect(svc.deriveMembershipTier(4)).toBe(MembershipTier.SILVER);
      expect(svc.deriveMembershipTier(1)).toBe(MembershipTier.BRONZE);
      expect(svc.evaluateBadge('unknown-badge', {}, false)).toBe(false);
    });
  });

  describe('getAiInsights', () => {
    it('should return cached insights', async () => {
      cache.get.mockResolvedValue({ summary: {} });
      await service.getAiInsights(USER_ID);
      expect(attemptModel.aggregate).not.toHaveBeenCalled();
    });

    it('should generate recommendations across types', async () => {
      cache.get.mockResolvedValue(undefined);
      jest.spyOn(service, 'getSubjectTopicBreakdown').mockResolvedValue({
        subjects: [
          {
            subjectId: SUB_ID,
            subjectName: 'Physics',
            averageScorePercent: 40,
            trend: 'declining',
            strengthLabel: 'Weak',
            weakTopicCount: 1,
            strongTopicCount: 1,
            topics: [
              {
                topicId: TOP_ID,
                topicName: 'Urgent',
                questionsAttempted: 5,
                correctAnswers: 1,
                accuracyPercent: 20,
                trend: 'declining',
                isWeak: true,
                isStrong: false,
              },
              {
                topicId: EXAM_ID,
                topicName: 'Border',
                questionsAttempted: 4,
                correctAnswers: 2,
                accuracyPercent: 50,
                trend: 'stable',
                isWeak: false,
                isStrong: false,
              },
              {
                topicId: ATTEMPT_ID,
                topicName: 'Tip',
                questionsAttempted: 4,
                correctAnswers: 2,
                accuracyPercent: 60,
                trend: 'improving',
                isWeak: false,
                isStrong: false,
              },
              {
                topicId: OTHER_ID,
                topicName: 'Strong',
                questionsAttempted: 8,
                correctAnswers: 7,
                accuracyPercent: 90,
                trend: 'stable',
                isWeak: false,
                isStrong: true,
              },
            ],
          },
          {
            subjectId: EXAM_ID,
            subjectName: 'Chem',
            averageScorePercent: 80,
            trend: 'stable',
            strengthLabel: 'Strong',
            weakTopicCount: 0,
            strongTopicCount: 0,
            topics: [],
          },
        ],
      } as any);
      jest.spyOn(service, 'getDashboard').mockResolvedValue({
        scoreAnalytics: { averageScorePercent: 55 },
      } as any);

      const result = await service.getAiInsights(USER_ID);
      expect(result.summary.weakAreaCount).toBe(1);
      expect(result.recommendations.map(r => r.type)).toEqual(
        expect.arrayContaining([
          'urgent-focus',
          'focus-area',
          'tip',
          'strength',
        ]),
      );
    });
  });

  describe('invalidateDashboardCache', () => {
    it('should delete known keys', async () => {
      await service.invalidateDashboardCache(USER_ID);
      expect(cache.del).toHaveBeenCalledTimes(6);
    });
  });
});
