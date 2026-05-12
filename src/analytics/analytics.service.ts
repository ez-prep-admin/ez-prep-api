import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { UsersService } from '../users/users.service';
import { MembershipTier } from '../common/enums/membership-tier.enum';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import {
  Question,
  QuestionDocument,
} from '../mock-test-attempts/schemas/question.schema';
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
import { RecentActivityItemDto } from './dto/recent-activity.dto';
import {
  SubjectTopicBreakdownDto,
  SubjectDetailedPerformanceDto,
  TopicPerformanceDto,
} from './dto/topic-performance.dto';
import { BadgeDto, UserBadgesDto } from './dto/badges.dto';
import {
  AiInsightsDto,
  InsightSummaryDto,
  RecommendationDto,
} from './dto/ai-insights.dto';
import { BADGE_CATALOG } from './constants/badges.constant';
import { PaginationMetaDto } from '../common/dto/api-response.dto';

/** Statuses that represent a test that has been scored and counts as "completed" */
const COMPLETED_STATUSES = ['SUBMITTED', 'EXPIRED'];

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LEADERBOARD_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RECENT_ACTIVITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUBJECT_TOPIC_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const BADGES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AI_INSIGHTS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Minimum attempts before showing a trend label */
const MIN_ATTEMPTS_FOR_TREND = 3;
/** Threshold delta (%) for improving/declining classification */
const TREND_THRESHOLD = 3;

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

interface RecentActivityAggResult {
  _id: Types.ObjectId;
  testTitle: string;
  score: number;
  totalQuestions: number;
  marksPerQuestion: number;
  negativeMarking: number;
  timeConsumed: number;
  submittedAt: Date;
  status: string;
  questions: Array<{
    isCorrect: boolean | null;
    selectedOption: string | null;
  }>;
  subjectId: Types.ObjectId | null;
  subjectName: string | null;
  subjectDescription: string | null;
  examId: Types.ObjectId | null;
  examName: string | null;
  examDescription: string | null;
  topicId: Types.ObjectId | null;
  topicName: string | null;
  topicDescription: string | null;
}

interface TopicAccuracyAggResult {
  subjectId: Types.ObjectId;
  subjectName: string;
  topicId: Types.ObjectId | null;
  topicName: string;
  totalQuestions: number;
  totalCorrect: number;
  totalAnswered: number;
}

interface SubjectTrendAggResult {
  _id: Types.ObjectId;
  scores: number[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(MockTestAttempt.name)
    private readonly mockTestAttemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly usersService: UsersService,
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
  // Public: Recent Activity
  // ---------------------------------------------------------------------------

  async getRecentActivity(
    userId: string,
    limit: number = 10,
  ): Promise<RecentActivityItemDto[]> {
    const validLimit = Math.min(Math.max(1, limit), 20);
    const cacheKey = `analytics:recent-activity:${userId}:${validLimit}`;
    const cached =
      await this.cacheManager.get<RecentActivityItemDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          user: new Types.ObjectId(userId),
          status: { $in: COMPLETED_STATUSES },
          submittedAt: { $exists: true },
        },
      },
      { $sort: { submittedAt: -1 } },
      { $limit: validLimit },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectDoc',
        },
      },
      {
        $lookup: {
          from: 'exams',
          localField: 'exam',
          foreignField: '_id',
          as: 'examDoc',
        },
      },
      {
        $lookup: {
          from: 'topics',
          localField: 'topic',
          foreignField: '_id',
          as: 'topicDoc',
        },
      },
      {
        $project: {
          testTitle: 1,
          score: 1,
          totalQuestions: 1,
          marksPerQuestion: 1,
          negativeMarking: 1,
          timeConsumed: 1,
          submittedAt: 1,
          status: 1,
          questions: 1,
          subjectId: '$subject',
          subjectName: { $arrayElemAt: ['$subjectDoc.name', 0] },
          subjectDescription: { $arrayElemAt: ['$subjectDoc.description', 0] },
          examId: '$exam',
          examName: { $arrayElemAt: ['$examDoc.name', 0] },
          examDescription: { $arrayElemAt: ['$examDoc.description', 0] },
          topicId: '$topic',
          topicName: { $arrayElemAt: ['$topicDoc.name', 0] },
          topicDescription: { $arrayElemAt: ['$topicDoc.description', 0] },
        },
      },
    ];

    const raw =
      await this.mockTestAttemptModel.aggregate<RecentActivityAggResult>(
        pipeline,
      );

    const result: RecentActivityItemDto[] = raw.map(item => {
      const totalPossible = item.totalQuestions * item.marksPerQuestion;

      // Calculate answer statistics
      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;

      item.questions.forEach(q => {
        if (!q.selectedOption) {
          unansweredCount++;
        } else if (q.isCorrect) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      });

      return {
        attemptId: item._id.toHexString(),
        testTitle: item.testTitle,
        scorePercent:
          totalPossible > 0
            ? Math.round((item.score / totalPossible) * 10000) / 100
            : 0,
        score: item.score,
        totalMarks: totalPossible,
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        unansweredQuestions: unansweredCount,
        totalQuestions: item.totalQuestions,
        timeConsumedMinutes: Math.round((item.timeConsumed / 60) * 10) / 10,
        submittedAt: item.submittedAt.toISOString(),
        status: item.status,
        subject: item.subjectId
          ? {
              id: item.subjectId.toHexString(),
              name: item.subjectName ?? 'Unknown',
              description: item.subjectDescription ?? undefined,
            }
          : null,
        exam: item.examId
          ? {
              id: item.examId.toHexString(),
              name: item.examName ?? 'Unknown',
              description: item.examDescription ?? undefined,
            }
          : null,
        topic: item.topicId
          ? {
              id: item.topicId.toHexString(),
              name: item.topicName ?? 'Unknown',
              description: item.topicDescription ?? undefined,
            }
          : null,
      };
    });

    await this.cacheManager.set(cacheKey, result, RECENT_ACTIVITY_CACHE_TTL_MS);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Public: Subject-Topic Breakdown
  // ---------------------------------------------------------------------------

  async getSubjectTopicBreakdown(
    userId: string,
  ): Promise<SubjectTopicBreakdownDto> {
    const cacheKey = `analytics:subject-topic:${userId}`;
    const cached =
      await this.cacheManager.get<SubjectTopicBreakdownDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const userObjectId = new Types.ObjectId(userId);

    // Pipeline 1: Per-topic accuracy via $lookup to questions collection
    const topicPipeline: PipelineStage[] = [
      {
        $match: {
          user: userObjectId,
          status: { $in: COMPLETED_STATUSES },
        },
      },
      { $unwind: '$questions' },
      {
        $lookup: {
          from: 'questions',
          localField: 'questions.question',
          foreignField: '_id',
          pipeline: [{ $project: { subject: 1, topic: 1 } }],
          as: 'questionDoc',
        },
      },
      { $unwind: '$questionDoc' },
      {
        $group: {
          _id: {
            subject: '$questionDoc.subject',
            topic: '$questionDoc.topic',
          },
          totalQuestions: { $sum: 1 },
          totalCorrect: {
            $sum: { $cond: ['$questions.isCorrect', 1, 0] },
          },
          totalAnswered: {
            $sum: {
              $cond: [{ $ne: ['$questions.selectedOption', null] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id.subject',
          foreignField: '_id',
          as: 'subjectDoc',
        },
      },
      {
        $lookup: {
          from: 'topics',
          localField: '_id.topic',
          foreignField: '_id',
          as: 'topicDoc',
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: '$_id.subject',
          subjectName: {
            $ifNull: [{ $arrayElemAt: ['$subjectDoc.name', 0] }, 'Unknown'],
          },
          topicId: '$_id.topic',
          topicName: {
            $ifNull: [{ $arrayElemAt: ['$topicDoc.name', 0] }, 'General'],
          },
          totalQuestions: 1,
          totalCorrect: 1,
          totalAnswered: 1,
        },
      },
    ];

    // Pipeline 2: Trend calculation — per-subject score arrays ordered by time
    const trendPipeline: PipelineStage[] = [
      {
        $match: {
          user: userObjectId,
          status: { $in: COMPLETED_STATUSES },
          subject: { $exists: true, $ne: null },
        },
      },
      { $sort: { submittedAt: -1 } },
      {
        $group: {
          _id: '$subject',
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
    ];

    const [topicResults, trendResults] = await Promise.all([
      this.mockTestAttemptModel.aggregate<TopicAccuracyAggResult>(
        topicPipeline,
      ),
      this.mockTestAttemptModel.aggregate<SubjectTrendAggResult>(trendPipeline),
    ]);

    // Build trend map: subjectId → trend label
    const trendMap = new Map<string, string>();
    for (const entry of trendResults) {
      const subjectKey = entry._id.toHexString();
      trendMap.set(subjectKey, this.computeTrend(entry.scores));
    }

    // Group topic results by subject
    const subjectMap = new Map<
      string,
      {
        subjectName: string;
        topics: TopicPerformanceDto[];
        totalCorrect: number;
        totalAnswered: number;
      }
    >();

    for (const row of topicResults) {
      const subKey = row.subjectId?.toHexString() ?? 'unknown';
      if (!subjectMap.has(subKey)) {
        subjectMap.set(subKey, {
          subjectName: row.subjectName,
          topics: [],
          totalCorrect: 0,
          totalAnswered: 0,
        });
      }
      const entry = subjectMap.get(subKey)!;
      entry.totalCorrect += row.totalCorrect;
      entry.totalAnswered += row.totalAnswered;

      if (row.topicId) {
        const accuracyPercent =
          row.totalAnswered > 0
            ? Math.round((row.totalCorrect / row.totalAnswered) * 10000) / 100
            : 0;
        entry.topics.push({
          topicId: row.topicId.toHexString(),
          topicName: row.topicName,
          questionsAttempted: row.totalQuestions,
          correctAnswers: row.totalCorrect,
          accuracyPercent,
          trend: 'insufficient-data', // Topic-level trend populated below
          isWeak: accuracyPercent < 50,
          isStrong: accuracyPercent >= 75,
        });
      }
    }

    // Build final subject array
    const subjects: SubjectDetailedPerformanceDto[] = [];
    for (const [subjectId, data] of subjectMap) {
      const avgScore =
        data.totalAnswered > 0
          ? Math.round((data.totalCorrect / data.totalAnswered) * 10000) / 100
          : 0;

      const trend = trendMap.get(subjectId) ?? 'insufficient-data';
      const strengthLabel =
        avgScore >= 75 ? 'Strong' : avgScore >= 50 ? 'Good' : 'Weak';

      // Sort topics: weak first, then by accuracy ascending
      data.topics.sort((a, b) => a.accuracyPercent - b.accuracyPercent);

      subjects.push({
        subjectId,
        subjectName: data.subjectName,
        averageScorePercent: avgScore,
        trend,
        strengthLabel,
        topics: data.topics,
        weakTopicCount: data.topics.filter(t => t.isWeak).length,
        strongTopicCount: data.topics.filter(t => t.isStrong).length,
      });
    }

    // Sort subjects: weakest first for attention prioritization
    subjects.sort((a, b) => a.averageScorePercent - b.averageScorePercent);

    const result: SubjectTopicBreakdownDto = { subjects };
    await this.cacheManager.set(cacheKey, result, SUBJECT_TOPIC_CACHE_TTL_MS);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Public: Badges
  // ---------------------------------------------------------------------------

  async getUserBadges(userId: string): Promise<UserBadgesDto> {
    const cacheKey = `analytics:badges:${userId}`;
    const cached = await this.cacheManager.get<UserBadgesDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get dashboard (cached) for most badge evaluations
    const dashboard = await this.getDashboard(userId);

    // Spot query for speed-demon badge: any attempt with time < 50% AND score >= 70%
    const speedDemonResult = await this.mockTestAttemptModel
      .findOne({
        user: new Types.ObjectId(userId),
        status: { $in: COMPLETED_STATUSES },
        $expr: {
          $and: [
            {
              $lt: [
                '$timeConsumed',
                { $multiply: ['$durationInMinutes', 30] }, // 50% of duration in seconds
              ],
            },
            {
              $gte: [
                {
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
                70,
              ],
            },
          ],
        },
      })
      .select('_id')
      .lean()
      .exec();

    const hasSpeedDemon = !!speedDemonResult;

    // Evaluate each badge
    const badges: BadgeDto[] = BADGE_CATALOG.map(def => ({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      criteria: def.criteria,
      isEarned: this.evaluateBadge(def.id, dashboard, hasSpeedDemon),
    }));

    const earnedCount = badges.filter(b => b.isEarned).length;

    const result: UserBadgesDto = {
      badges,
      earnedCount,
      totalCount: badges.length,
    };

    await this.cacheManager.set(cacheKey, result, BADGES_CACHE_TTL_MS);

    // Async (fire-and-forget): update membership tier on User document.
    // Runs only on cache-miss (fresh computation) — never blocks the response.
    const tier = this.deriveMembershipTier(earnedCount);
    Promise.resolve()
      .then(() =>
        this.usersService.updateMembershipTier(userId, tier, earnedCount),
      )
      .catch(() => void 0);

    return result;
  }

  /** Maps badge earned count to a membership tier. */
  private deriveMembershipTier(earnedCount: number): MembershipTier {
    if (earnedCount >= 10) return MembershipTier.PLATINUM;
    if (earnedCount >= 7) return MembershipTier.GOLD;
    if (earnedCount >= 4) return MembershipTier.SILVER;
    if (earnedCount >= 1) return MembershipTier.BRONZE;
    return MembershipTier.NONE;
  }

  // ---------------------------------------------------------------------------
  // Public: AI Insights
  // ---------------------------------------------------------------------------

  async getAiInsights(userId: string): Promise<AiInsightsDto> {
    const cacheKey = `analytics:ai-insights:${userId}`;
    const cached = await this.cacheManager.get<AiInsightsDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Reuse cached subject-topic breakdown as the data source
    const breakdown = await this.getSubjectTopicBreakdown(userId);
    const dashboard = await this.getDashboard(userId);

    // Summary
    const weakAreaCount = breakdown.subjects.filter(
      s => s.strengthLabel === 'Weak',
    ).length;
    const strongAreaCount = breakdown.subjects.filter(
      s => s.strengthLabel === 'Strong',
    ).length;

    const summary: InsightSummaryDto = {
      averageScorePercent: dashboard.scoreAnalytics.averageScorePercent,
      weakAreaCount,
      strongAreaCount,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(breakdown.subjects);

    const result: AiInsightsDto = {
      summary,
      subjectBreakdown: breakdown.subjects,
      recommendations,
    };

    await this.cacheManager.set(cacheKey, result, AI_INSIGHTS_CACHE_TTL_MS);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Cache invalidation (call after a user's attempt is submitted/expired)
  // ---------------------------------------------------------------------------

  async invalidateDashboardCache(userId: string): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`analytics:dashboard:${userId}`),
      this.cacheManager.del(`analytics:recent-activity:${userId}:10`),
      this.cacheManager.del(`analytics:recent-activity:${userId}:20`),
      this.cacheManager.del(`analytics:subject-topic:${userId}`),
      this.cacheManager.del(`analytics:badges:${userId}`),
      this.cacheManager.del(`analytics:ai-insights:${userId}`),
    ]);
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

  /**
   * Compute trend from a score array ordered most-recent-first.
   * Compares average of first 5 (recent) vs next 5 (previous).
   */
  private computeTrend(scoresRecentFirst: number[]): string {
    if (scoresRecentFirst.length < MIN_ATTEMPTS_FOR_TREND) {
      return 'insufficient-data';
    }
    const recent = scoresRecentFirst.slice(0, 5);
    const previous = scoresRecentFirst.slice(5, 10);
    if (previous.length === 0) {
      return 'stable';
    }
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    const delta = recentAvg - previousAvg;

    if (delta > TREND_THRESHOLD) return 'improving';
    if (delta < -TREND_THRESHOLD) return 'declining';
    return 'stable';
  }

  /**
   * Evaluate whether a specific badge is earned based on dashboard metrics.
   */
  private evaluateBadge(
    badgeId: string,
    dashboard: UserDashboardDto,
    hasSpeedDemon: boolean,
  ): boolean {
    switch (badgeId) {
      case 'first-test':
        return dashboard.testsSummary.completed >= 1;
      case 'streak-7':
        return dashboard.streak.longestStreak >= 7;
      case 'streak-30':
        return dashboard.streak.longestStreak >= 30;
      case 'tests-10':
        return dashboard.testsSummary.completed >= 10;
      case 'tests-50':
        return dashboard.testsSummary.completed >= 50;
      case 'top-scorer':
        return dashboard.scoreAnalytics.bestScorePercent >= 90;
      case 'perfect-score':
        return dashboard.scoreAnalytics.bestScorePercent >= 100;
      case 'speed-demon':
        return hasSpeedDemon;
      case 'accuracy-master':
        return (
          dashboard.testsSummary.completed >= 10 &&
          dashboard.accuracy.accuracyPercent >= 80
        );
      case 'subject-expert':
        return dashboard.subjectPerformance.some(
          s => s.attemptCount >= 5 && s.averageScorePercent >= 85,
        );
      default:
        return false;
    }
  }

  /**
   * Generate rule-based recommendations from subject-topic performance data.
   * Returns up to 8 recommendations sorted by priority.
   */
  private generateRecommendations(
    subjects: SubjectDetailedPerformanceDto[],
  ): RecommendationDto[] {
    const recommendations: RecommendationDto[] = [];

    for (const subject of subjects) {
      for (const topic of subject.topics) {
        // Urgent Focus: topic < 45% in a subject < 70%
        if (
          topic.accuracyPercent < 45 &&
          subject.averageScorePercent < 70 &&
          topic.questionsAttempted >= 3
        ) {
          recommendations.push({
            type: 'urgent-focus',
            title: `${subject.subjectName} — ${topic.topicName}`,
            description: `Your score in ${topic.topicName} is ${topic.accuracyPercent}% — significantly below your average. This topic needs immediate attention.`,
            priority: 1,
          });
          continue;
        }

        // Focus Area: subject declining OR topic 45-55%
        if (
          topic.accuracyPercent >= 45 &&
          topic.accuracyPercent < 55 &&
          topic.questionsAttempted >= 3
        ) {
          recommendations.push({
            type: 'focus-area',
            title: `${subject.subjectName} — ${topic.topicName}`,
            description: `${topic.topicName} (${topic.accuracyPercent}%) is a borderline area that could improve with targeted practice.`,
            priority: 2,
          });
          continue;
        }

        // Tip: topic improving but still < 70%
        if (
          topic.trend === 'improving' &&
          topic.accuracyPercent < 70 &&
          topic.accuracyPercent >= 55
        ) {
          recommendations.push({
            type: 'tip',
            title: `${subject.subjectName} — ${topic.topicName}`,
            description: `${topic.topicName} is improving in trend but needs more practice. Keep focusing on ${subject.subjectName} fundamentals.`,
            priority: 3,
          });
          continue;
        }

        // Strength: topic >= 80%
        if (topic.accuracyPercent >= 80 && topic.questionsAttempted >= 5) {
          recommendations.push({
            type: 'strength',
            title: `${subject.subjectName} — ${topic.topicName}`,
            description: `${topic.topicName} is your strongest area at ${topic.accuracyPercent}% with ${topic.questionsAttempted} questions. Maintain with periodic revision.`,
            priority: 4,
          });
        }
      }

      // Subject-level declining trend
      if (subject.trend === 'declining' && subject.averageScorePercent < 70) {
        recommendations.push({
          type: 'focus-area',
          title: `${subject.subjectName}`,
          description: `${subject.subjectName} (${subject.averageScorePercent}%) is showing a declining trend. Consider reviewing the fundamentals before attempting more tests.`,
          priority: 2,
        });
      }
    }

    // Sort by priority, limit to 8
    return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 8);
  }
}
