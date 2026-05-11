import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserDashboardDto, TestsSummaryDto } from './dto/user-dashboard.dto';
import { StreakDto } from './dto/streak.dto';
import { ScoreAnalyticsDto } from './dto/score-analytics.dto';
import { AccuracyDto } from './dto/accuracy.dto';
import { TimeInvestmentDto } from './dto/time-investment.dto';
import {
  SubjectPerformanceDto,
  ExamPerformanceDto,
} from './dto/subject-performance.dto';
import { LeaderboardEntryDto, UserRankDto } from './dto/leaderboard-entry.dto';
import { PaginationMetaDto } from '../common/dto/api-response.dto';

/** Statuses that represent a test that has been scored and counts as "completed" */
const COMPLETED_STATUSES = ['SUBMITTED', 'EXPIRED'];

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LEADERBOARD_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Internal aggregation result interfaces (not exposed in API responses)
// ---------------------------------------------------------------------------

interface SummaryFacetResult {
  totalAttempts: number;
  completedAttempts: number;
  totalTimeConsumed: number;
  averageScorePercent: number;
  bestScorePercent: number;
}

interface AccuracyFacetResult {
  totalCorrect: number;
  totalAnswered: number;
  totalUnanswered: number;
}

interface SubjectFacetResult {
  _id: Types.ObjectId;
  subjectName: string;
  attemptCount: number;
  averageScorePercent: number;
}

interface ExamFacetResult {
  _id: Types.ObjectId;
  examName: string;
  attemptCount: number;
  averageScorePercent: number;
}

interface StreakDateFacetResult {
  dateStr: string; // 'YYYY-MM-DD'
}

interface DashboardFacetRaw {
  summary: SummaryFacetResult[];
  streakDates: StreakDateFacetResult[];
  accuracy: AccuracyFacetResult[];
  subjectPerformance: SubjectFacetResult[];
  examPerformance: ExamFacetResult[];
}

interface LeaderboardAggResult {
  userId: Types.ObjectId;
  userName: string;
  averageScorePercent: number;
  totalAttempts: number;
  totalCorrect: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(MockTestAttempt.name)
    private readonly mockTestAttemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // ---------------------------------------------------------------------------
  // Public: Dashboard
  // ---------------------------------------------------------------------------

  async getDashboard(userId: string): Promise<UserDashboardDto> {
    const cacheKey = `analytics:dashboard:${userId}`;
    const cached = await this.cacheManager.get<UserDashboardDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const userObjectId = new Types.ObjectId(userId);

    // Single $facet aggregation — one MongoDB round-trip for all user metrics
    const pipeline: PipelineStage[] = [
      {
        $match: {
          user: userObjectId,
        },
      },
      {
        $facet: {
          // ---- Summary: counts and aggregate scores ----
          summary: [
            {
              $group: {
                _id: null,
                totalAttempts: { $sum: 1 },
                completedAttempts: {
                  $sum: {
                    $cond: [{ $in: ['$status', COMPLETED_STATUSES] }, 1, 0],
                  },
                },
                totalTimeConsumed: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', COMPLETED_STATUSES] },
                      '$timeConsumed',
                      0,
                    ],
                  },
                },
                // Compute scorePercent inline using accumulated data
                // We collect per-attempt scores to average them
                scores: {
                  $push: {
                    $cond: [
                      { $in: ['$status', COMPLETED_STATUSES] },
                      {
                        $multiply: [
                          {
                            $divide: [
                              '$score',
                              {
                                $multiply: [
                                  '$totalQuestions',
                                  '$marksPerQuestion',
                                ],
                              },
                            ],
                          },
                          100,
                        ],
                      },
                      '$$REMOVE',
                    ],
                  },
                },
              },
            },
            {
              $addFields: {
                averageScorePercent: {
                  $cond: [
                    { $gt: [{ $size: '$scores' }, 0] },
                    {
                      $round: [{ $avg: '$scores' }, 2],
                    },
                    0,
                  ],
                },
                bestScorePercent: {
                  $cond: [
                    { $gt: [{ $size: '$scores' }, 0] },
                    { $round: [{ $max: '$scores' }, 2] },
                    0,
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalAttempts: 1,
                completedAttempts: 1,
                totalTimeConsumed: 1,
                averageScorePercent: 1,
                bestScorePercent: 1,
              },
            },
          ],

          // ---- Streak: distinct submission days for completed attempts ----
          streakDates: [
            {
              $match: {
                status: { $in: COMPLETED_STATUSES },
                submittedAt: { $exists: true },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' },
                },
              },
            },
            { $sort: { _id: -1 } },
            {
              $project: {
                _id: 0,
                dateStr: '$_id',
              },
            },
          ],

          // ---- Accuracy: correct vs answered across all completed attempts ----
          accuracy: [
            {
              $match: { status: { $in: COMPLETED_STATUSES } },
            },
            { $unwind: '$questions' },
            {
              $group: {
                _id: null,
                totalCorrect: {
                  $sum: {
                    $cond: ['$questions.isCorrect', 1, 0],
                  },
                },
                totalAnswered: {
                  $sum: {
                    $cond: [{ $ne: ['$questions.selectedOption', null] }, 1, 0],
                  },
                },
                totalUnanswered: {
                  $sum: {
                    $cond: [{ $eq: ['$questions.selectedOption', null] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalCorrect: 1,
                totalAnswered: 1,
                totalUnanswered: 1,
              },
            },
          ],

          // ---- Subject performance ----
          subjectPerformance: [
            {
              $match: {
                status: { $in: COMPLETED_STATUSES },
                subject: { $exists: true, $ne: null },
              },
            },
            {
              $group: {
                _id: '$subject',
                attemptCount: { $sum: 1 },
                scores: {
                  $push: {
                    $multiply: [
                      {
                        $divide: [
                          '$score',
                          {
                            $multiply: ['$totalQuestions', '$marksPerQuestion'],
                          },
                        ],
                      },
                      100,
                    ],
                  },
                },
              },
            },
            {
              $addFields: {
                averageScorePercent: { $round: [{ $avg: '$scores' }, 2] },
              },
            },
            {
              $lookup: {
                from: 'subjects',
                localField: '_id',
                foreignField: '_id',
                as: 'subjectDoc',
              },
            },
            {
              $addFields: {
                subjectName: {
                  $ifNull: [
                    { $arrayElemAt: ['$subjectDoc.name', 0] },
                    'Unknown',
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                subjectName: 1,
                attemptCount: 1,
                averageScorePercent: 1,
              },
            },
            { $sort: { averageScorePercent: -1 } },
          ],

          // ---- Exam performance ----
          examPerformance: [
            {
              $match: {
                status: { $in: COMPLETED_STATUSES },
                exam: { $exists: true, $ne: null },
              },
            },
            {
              $group: {
                _id: '$exam',
                attemptCount: { $sum: 1 },
                scores: {
                  $push: {
                    $multiply: [
                      {
                        $divide: [
                          '$score',
                          {
                            $multiply: ['$totalQuestions', '$marksPerQuestion'],
                          },
                        ],
                      },
                      100,
                    ],
                  },
                },
              },
            },
            {
              $addFields: {
                averageScorePercent: { $round: [{ $avg: '$scores' }, 2] },
              },
            },
            {
              $lookup: {
                from: 'exams',
                localField: '_id',
                foreignField: '_id',
                as: 'examDoc',
              },
            },
            {
              $addFields: {
                examName: {
                  $ifNull: [{ $arrayElemAt: ['$examDoc.name', 0] }, 'Unknown'],
                },
              },
            },
            {
              $project: {
                _id: 1,
                examName: 1,
                attemptCount: 1,
                averageScorePercent: 1,
              },
            },
            { $sort: { averageScorePercent: -1 } },
          ],
        },
      },
    ];

    const [raw] =
      await this.mockTestAttemptModel.aggregate<DashboardFacetRaw>(pipeline);

    const dashboard = this.buildDashboard(raw);

    await this.cacheManager.set(cacheKey, dashboard, DASHBOARD_CACHE_TTL_MS);

    return dashboard;
  }

  // ---------------------------------------------------------------------------
  // Public: Leaderboard
  // ---------------------------------------------------------------------------

  async getLeaderboard(
    currentUserId: string,
    page: number,
    limit: number,
    examId?: string,
    subjectId?: string,
  ): Promise<{
    data: LeaderboardEntryDto[];
    pagination: PaginationMetaDto;
    currentUserRank: UserRankDto;
  }> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 50);
    const skip = (validPage - 1) * validLimit;

    const cacheKey = `analytics:leaderboard:${examId ?? 'all'}:${subjectId ?? 'all'}:${validPage}:${validLimit}:${currentUserId}`;
    const cached = await this.cacheManager.get<{
      data: LeaderboardEntryDto[];
      pagination: PaginationMetaDto;
      currentUserRank: UserRankDto;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const matchStage: Record<string, unknown> = {
      status: { $in: COMPLETED_STATUSES },
    };
    if (examId) {
      matchStage['exam'] = new Types.ObjectId(examId);
    }
    if (subjectId) {
      matchStage['subject'] = new Types.ObjectId(subjectId);
    }

    // Build ranked leaderboard via aggregation
    const rankingPipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          totalAttempts: { $sum: 1 },
          totalCorrect: {
            $sum: {
              $size: {
                $filter: {
                  input: '$questions',
                  as: 'q',
                  cond: { $eq: ['$$q.isCorrect', true] },
                },
              },
            },
          },
          scores: {
            $push: {
              $multiply: [
                {
                  $divide: [
                    '$score',
                    { $multiply: ['$totalQuestions', '$marksPerQuestion'] },
                  ],
                },
                100,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          averageScorePercent: { $round: [{ $avg: '$scores' }, 2] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      {
        $addFields: {
          userName: {
            $ifNull: [{ $arrayElemAt: ['$userDoc.name', 0] }, 'Unknown'],
          },
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          userName: 1,
          averageScorePercent: 1,
          totalAttempts: 1,
          totalCorrect: 1,
        },
      },
      { $sort: { averageScorePercent: -1, totalAttempts: -1 } },
    ];

    // Get total count and paginated page in parallel
    const [allRankedUsers] = await Promise.all([
      this.mockTestAttemptModel.aggregate<LeaderboardAggResult>(
        rankingPipeline,
      ),
    ]);

    const total = allRankedUsers.length;
    const totalPages = Math.ceil(total / validLimit);

    // Assign dense rank (ties get same rank)
    let currentRank = 1;
    const rankedWithPosition = allRankedUsers.map((entry, index) => {
      if (
        index > 0 &&
        entry.averageScorePercent <
          allRankedUsers[index - 1].averageScorePercent
      ) {
        currentRank = index + 1;
      }
      return { ...entry, rank: currentRank };
    });

    // Slice the page
    const pageSlice = rankedWithPosition.slice(skip, skip + validLimit);
    const currentUserObjectId = new Types.ObjectId(currentUserId);

    const data: LeaderboardEntryDto[] = pageSlice.map(entry => ({
      rank: entry.rank,
      userId: entry.userId.toHexString(),
      userName: entry.userName,
      averageScorePercent: entry.averageScorePercent,
      totalAttempts: entry.totalAttempts,
      totalCorrect: entry.totalCorrect,
      isCurrentUser: entry.userId.equals(currentUserObjectId),
    }));

    // Find current user's rank (may not be on current page)
    const currentUserEntry = rankedWithPosition.find(e =>
      e.userId.equals(currentUserObjectId),
    );
    const currentUserRank: UserRankDto = {
      rank: currentUserEntry?.rank ?? null,
      averageScorePercent: currentUserEntry?.averageScorePercent ?? null,
    };

    const result = {
      data,
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
      currentUserRank,
    };

    await this.cacheManager.set(cacheKey, result, LEADERBOARD_CACHE_TTL_MS);

    return result;
  }

  // ---------------------------------------------------------------------------
  // Cache invalidation (call after a user's attempt is submitted/expired)
  // ---------------------------------------------------------------------------

  async invalidateDashboardCache(userId: string): Promise<void> {
    await this.cacheManager.del(`analytics:dashboard:${userId}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildDashboard(raw: DashboardFacetRaw): UserDashboardDto {
    const summary = raw.summary[0] ?? {
      totalAttempts: 0,
      completedAttempts: 0,
      totalTimeConsumed: 0,
      averageScorePercent: 0,
      bestScorePercent: 0,
    };

    const accuracyRaw = raw.accuracy[0] ?? {
      totalCorrect: 0,
      totalAnswered: 0,
      totalUnanswered: 0,
    };

    // Tests summary
    const testsSummary: TestsSummaryDto = {
      attempted: summary.totalAttempts,
      completed: summary.completedAttempts,
      completionRate:
        summary.totalAttempts > 0
          ? Math.round(
              (summary.completedAttempts / summary.totalAttempts) * 10000,
            ) / 100
          : 0,
    };

    // Score analytics
    const scoreAnalytics: ScoreAnalyticsDto = {
      averageScorePercent: summary.averageScorePercent,
      bestScorePercent: summary.bestScorePercent,
      totalTestsScored: summary.completedAttempts,
    };

    // Accuracy
    const accuracy: AccuracyDto = {
      totalCorrect: accuracyRaw.totalCorrect,
      totalAnswered: accuracyRaw.totalAnswered,
      totalUnanswered: accuracyRaw.totalUnanswered,
      accuracyPercent:
        accuracyRaw.totalAnswered > 0
          ? Math.round(
              (accuracyRaw.totalCorrect / accuracyRaw.totalAnswered) * 10000,
            ) / 100
          : 0,
    };

    // Time investment (timeConsumed is in seconds)
    const totalMinutes = Math.round((summary.totalTimeConsumed / 60) * 10) / 10;
    const timeInvestment: TimeInvestmentDto = {
      totalMinutes,
      averageMinutesPerAttempt:
        summary.completedAttempts > 0
          ? Math.round((totalMinutes / summary.completedAttempts) * 10) / 10
          : 0,
    };

    // Streak
    const streak = this.computeStreak(raw.streakDates.map(d => d.dateStr));

    // Subject performance
    const subjectPerformance: SubjectPerformanceDto[] =
      raw.subjectPerformance.map(s => ({
        subjectId: s._id.toHexString(),
        subjectName: s.subjectName,
        attemptCount: s.attemptCount,
        averageScorePercent: s.averageScorePercent,
      }));

    // Exam performance
    const examPerformance: ExamPerformanceDto[] = raw.examPerformance.map(
      e => ({
        examId: e._id.toHexString(),
        examName: e.examName,
        attemptCount: e.attemptCount,
        averageScorePercent: e.averageScorePercent,
      }),
    );

    return {
      streak,
      testsSummary,
      scoreAnalytics,
      accuracy,
      timeInvestment,
      subjectPerformance,
      examPerformance,
    };
  }

  /**
   * Compute current streak and longest streak from an array of 'YYYY-MM-DD' date strings.
   * The array should be sorted descending (most recent first) — as returned by the aggregation.
   */
  private computeStreak(sortedDatesDesc: string[]): StreakDto {
    if (sortedDatesDesc.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    }

    const lastActiveDate = sortedDatesDesc[0];

    // Check if the user was active today or yesterday (allow yesterday to keep streak alive)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayStr = this.toDateStr(today);
    const yesterdayStr = this.toDateStr(yesterday);

    const mostRecentDate = sortedDatesDesc[0];
    const isStreakAlive =
      mostRecentDate === todayStr || mostRecentDate === yesterdayStr;

    // Convert to sorted dates (ascending) as Date objects for easier arithmetic
    const uniqueDates = [...new Set(sortedDatesDesc)]
      .map(d => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());

    let currentStreak = 0;
    let longestStreak = 1;
    let runningStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const diffDays = Math.round(
        (uniqueDates[i].getTime() - uniqueDates[i - 1].getTime()) / 86_400_000,
      );
      if (diffDays === 1) {
        runningStreak++;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 1;
      }
    }

    // Calculate current streak from the most recent date backwards
    if (isStreakAlive) {
      currentStreak = 1;
      const reversedDates = [...uniqueDates].reverse();
      for (let i = 1; i < reversedDates.length; i++) {
        const diffDays = Math.round(
          (reversedDates[i - 1].getTime() - reversedDates[i].getTime()) /
            86_400_000,
        );
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { currentStreak, longestStreak, lastActiveDate };
  }

  private toDateStr(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
