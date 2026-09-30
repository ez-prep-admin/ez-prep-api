import { PipelineStage, Types } from 'mongoose';
import { PaperType } from '../common/enums/paper-type.enum';
import { FINISHED_ATTEMPT_STATUSES } from './admin-users.attempt-counts';

/** Recent lists never return more than this many finished attempts per paper type. */
export const RECENT_FINISHED_ATTEMPT_LIMIT = 5;

/**
 * Recent form compares the latest scored test with the oldest scored test
 * in the last five finished attempts. A move of this many percentage points
 * is improving or declining; anything smaller is steady.
 */
export const PERFORMANCE_TREND_THRESHOLD = 5;

export type PerformanceTrend =
  | 'improving'
  | 'declining'
  | 'steady'
  | 'insufficient';

export type DetailPaperType = 'TOPIC_WISE' | 'FULL_EXAM';

export interface FinishedAttemptSummary {
  id: string;
  mockTestId: string;
  title: string;
  paperType: DetailPaperType;
  status: 'SUBMITTED' | 'EXPIRED';
  score: number;
  totalMarks: number;
  percentage: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  totalQuestions: number;
  passingScore: number | null;
  passed: boolean | null;
  examName: string | null;
  subjectName: string | null;
  topicName: string | null;
  timeConsumedSeconds: number;
  durationInMinutes: number;
  startedAt?: Date;
  submittedAt?: Date;
}

export interface PaperPerformance {
  finishedCount: number;
  score: number;
  totalMarks: number;
  /** Marks earned divided by marks available, across every finished attempt. */
  percentage: number | null;
  /** Mean of each finished attempt's percentage. Tests with no marks are left out. */
  averagePercentage: number | null;
  bestPercentage: number | null;
  latestPercentage: number | null;
  /** Correct answers divided by answered questions. Unanswered questions are left out. */
  accuracy: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  passedCount: number;
  gradedCount: number;
  trend: PerformanceTrend;
}

export interface UserPerformanceAnalysis {
  topicWise: PaperPerformance;
  fullExam: PaperPerformance;
  overall: PaperPerformance;
}

export interface MappedUserPerformance {
  recentTopicWiseAttempts: FinishedAttemptSummary[];
  recentFullExamAttempts: FinishedAttemptSummary[];
  analysis: UserPerformanceAnalysis;
}

export interface RawFinishedAttempt {
  _id?: unknown;
  mockTest?: unknown;
  testTitle?: unknown;
  paperType?: unknown;
  status?: unknown;
  score?: unknown;
  totalMarks?: unknown;
  correct?: unknown;
  incorrect?: unknown;
  unanswered?: unknown;
  totalQuestions?: unknown;
  passingScore?: unknown;
  examName?: unknown;
  subjectName?: unknown;
  topicName?: unknown;
  timeConsumed?: unknown;
  durationInMinutes?: unknown;
  startedAt?: unknown;
  submittedAt?: unknown;
}

export interface RawPaperStats {
  _id?: unknown;
  finishedCount?: unknown;
  totalScore?: unknown;
  totalMarks?: unknown;
  percentageSum?: unknown;
  percentageCount?: unknown;
  bestPercentage?: unknown;
  correct?: unknown;
  incorrect?: unknown;
  unanswered?: unknown;
  passedCount?: unknown;
  gradedCount?: unknown;
}

export interface UserPerformanceAggregate {
  recentTopicWise?: RawFinishedAttempt[] | null;
  recentFullExam?: RawFinishedAttempt[] | null;
  recentOverall?: RawFinishedAttempt[] | null;
  stats?: RawPaperStats[] | null;
}

export const EMPTY_PAPER_PERFORMANCE: PaperPerformance = {
  finishedCount: 0,
  score: 0,
  totalMarks: 0,
  percentage: null,
  averagePercentage: null,
  bestPercentage: null,
  latestPercentage: null,
  accuracy: null,
  correct: 0,
  incorrect: 0,
  unanswered: 0,
  passedCount: 0,
  gradedCount: 0,
  trend: 'insufficient',
};

/** Uses `totalMarks` after the pipeline renames `resolvedTotalMarks`. */
function percentageExpression(): Record<string, unknown> {
  return {
    $cond: [
      { $gt: ['$totalMarks', 0] },
      {
        $multiply: [
          {
            $divide: [{ $ifNull: ['$score', 0] }, '$totalMarks'],
          },
          100,
        ],
      },
      null,
    ],
  };
}

function questionCount(condition: Record<string, unknown>) {
  return {
    $size: {
      $filter: {
        input: { $ifNull: ['$questions', []] },
        as: 'q',
        cond: condition,
      },
    },
  };
}

/** Matches attempt scoring: a missing selection is unanswered, not incorrect. */
function selectedOptionPresent(): Record<string, unknown> {
  return {
    $and: [
      { $ne: [{ $ifNull: ['$$q.selectedOption', null] }, null] },
      { $ne: ['$$q.selectedOption', ''] },
    ],
  };
}

function selectedOptionMissing(): Record<string, unknown> {
  return {
    $or: [
      { $eq: [{ $ifNull: ['$$q.selectedOption', null] }, null] },
      { $eq: ['$$q.selectedOption', ''] },
    ],
  };
}

function recentAttemptProject(): Record<string, unknown> {
  return {
    $project: {
      mockTest: 1,
      testTitle: 1,
      paperType: 1,
      status: 1,
      score: { $ifNull: ['$score', 0] },
      totalMarks: '$resolvedTotalMarks',
      correct: 1,
      incorrect: 1,
      unanswered: 1,
      totalQuestions: 1,
      passingScore: 1,
      examName: 1,
      subjectName: 1,
      topicName: 1,
      timeConsumed: { $ifNull: ['$timeConsumed', 0] },
      durationInMinutes: { $ifNull: ['$durationInMinutes', 0] },
      startedAt: 1,
      submittedAt: 1,
      createdAt: 1,
    },
  };
}

/**
 * Finished attempts for one learner.
 * SUBMITTED and EXPIRED are scored. Open attempts are excluded.
 * Each recent list is the newest finished attempts of that paper type,
 * capped at {@link RECENT_FINISHED_ATTEMPT_LIMIT}. Stats cover every
 * finished attempt, not only the recent window.
 * A paper with no type, or any type other than FULL_EXAM, is topic-wise.
 */
export function buildUserPerformancePipeline(
  userId: Types.ObjectId,
): PipelineStage[] {
  const limit = RECENT_FINISHED_ATTEMPT_LIMIT;
  const percent = percentageExpression();

  return [
    {
      $match: {
        user: userId,
        status: { $in: [...FINISHED_ATTEMPT_STATUSES] },
      },
    },
    {
      $lookup: {
        from: 'mocktests',
        localField: 'mockTest',
        foreignField: '_id',
        as: 'paper',
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
        from: 'subjects',
        localField: 'subject',
        foreignField: '_id',
        as: 'subjectDoc',
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
      $addFields: {
        paperType: {
          $ifNull: [
            { $arrayElemAt: ['$paper.paperType', 0] },
            PaperType.TOPIC_WISE,
          ],
        },
        examName: {
          $ifNull: [{ $arrayElemAt: ['$examDoc.name', 0] }, null],
        },
        subjectName: {
          $ifNull: [{ $arrayElemAt: ['$subjectDoc.name', 0] }, null],
        },
        topicName: {
          $ifNull: [{ $arrayElemAt: ['$topicDoc.name', 0] }, null],
        },
        correct: questionCount({
          $and: [selectedOptionPresent(), { $eq: ['$$q.isCorrect', true] }],
        }),
        incorrect: questionCount({
          $and: [selectedOptionPresent(), { $ne: ['$$q.isCorrect', true] }],
        }),
        unanswered: questionCount(selectedOptionMissing()),
        totalQuestions: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ['$questions', []] } }, 0] },
            { $size: { $ifNull: ['$questions', []] } },
            { $ifNull: ['$totalQuestions', 0] },
          ],
        },
        resolvedTotalMarks: {
          $let: {
            vars: {
              questionCount: { $size: { $ifNull: ['$questions', []] } },
            },
            in: {
              $cond: [
                { $gt: ['$$questionCount', 0] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ['$questions', []] },
                      as: 'q',
                      in: {
                        $ifNull: [
                          '$$q.marksPerQuestion',
                          { $ifNull: ['$marksPerQuestion', 0] },
                        ],
                      },
                    },
                  },
                },
                {
                  $multiply: [
                    { $ifNull: ['$totalQuestions', 0] },
                    { $ifNull: ['$marksPerQuestion', 0] },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    recentAttemptProject() as unknown as PipelineStage,
    {
      $sort: {
        submittedAt: -1,
        startedAt: -1,
        createdAt: -1,
      },
    },
    {
      $facet: {
        recentTopicWise: [
          { $match: { paperType: { $ne: PaperType.FULL_EXAM } } },
          { $limit: limit },
        ],
        recentFullExam: [
          { $match: { paperType: PaperType.FULL_EXAM } },
          { $limit: limit },
        ],
        recentOverall: [{ $limit: limit }],
        stats: [
          {
            $group: {
              _id: {
                $cond: [
                  { $eq: ['$paperType', PaperType.FULL_EXAM] },
                  PaperType.FULL_EXAM,
                  PaperType.TOPIC_WISE,
                ],
              },
              finishedCount: { $sum: 1 },
              totalScore: { $sum: { $ifNull: ['$score', 0] } },
              totalMarks: { $sum: { $ifNull: ['$totalMarks', 0] } },
              percentageSum: {
                $sum: {
                  $cond: [{ $gt: ['$totalMarks', 0] }, percent, 0],
                },
              },
              percentageCount: {
                $sum: {
                  $cond: [{ $gt: ['$totalMarks', 0] }, 1, 0],
                },
              },
              bestPercentage: { $max: percent },
              correct: { $sum: { $ifNull: ['$correct', 0] } },
              incorrect: { $sum: { $ifNull: ['$incorrect', 0] } },
              unanswered: { $sum: { $ifNull: ['$unanswered', 0] } },
              passedCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $ifNull: ['$passingScore', 0] }, 0] },
                        {
                          $gte: [{ $ifNull: ['$score', 0] }, '$passingScore'],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              gradedCount: {
                $sum: {
                  $cond: [
                    { $gt: [{ $ifNull: ['$passingScore', 0] }, 0] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
      },
    },
  ];
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function nonNegativeCount(value: unknown): number {
  return Math.max(0, Math.trunc(finiteNumber(value, 0)));
}

export function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function toPercentage(score: number, totalMarks: number): number | null {
  if (
    !Number.isFinite(score) ||
    !Number.isFinite(totalMarks) ||
    totalMarks <= 0
  ) {
    return null;
  }
  return roundPercent((score / totalMarks) * 100);
}

function accuracyPercent(correct: number, incorrect: number): number | null {
  const answered = correct + incorrect;
  if (answered <= 0) {
    return null;
  }
  return roundPercent((correct / answered) * 100);
}

/**
 * A passing mark of 0 is treated as "no pass mark", matching attempt results
 * where a falsy `passingScore` means the paper was not graded.
 */
export function passedAgainstMark(
  score: number,
  passingScore: unknown,
): { passingScore: number | null; passed: boolean | null } {
  if (typeof passingScore !== 'number' || !Number.isFinite(passingScore)) {
    return { passingScore: null, passed: null };
  }
  if (passingScore <= 0) {
    return { passingScore: null, passed: null };
  }
  return { passingScore, passed: score >= passingScore };
}

export function performanceTrend(
  newestFirstPercentages: Array<number | null | undefined>,
): PerformanceTrend {
  const scored = newestFirstPercentages.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  if (scored.length < 2) {
    return 'insufficient';
  }
  const delta = scored[0] - scored[scored.length - 1];
  if (delta >= PERFORMANCE_TREND_THRESHOLD) {
    return 'improving';
  }
  if (delta <= -PERFORMANCE_TREND_THRESHOLD) {
    return 'declining';
  }
  return 'steady';
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return undefined;
}

function asLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function attemptTimestamp(attempt: RawFinishedAttempt): number {
  return (
    asDate(attempt.submittedAt)?.getTime() ??
    asDate(attempt.startedAt)?.getTime() ??
    0
  );
}

function isFinishedStatus(status: unknown): status is 'SUBMITTED' | 'EXPIRED' {
  return status === 'SUBMITTED' || status === 'EXPIRED';
}

function paperTypeOf(value: unknown): DetailPaperType {
  return value === PaperType.FULL_EXAM ? 'FULL_EXAM' : 'TOPIC_WISE';
}

function idOf(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value && '_id' in value) {
    return String((value as { _id: unknown })._id ?? '');
  }
  return String(value);
}

export function mapFinishedAttempt(
  raw: RawFinishedAttempt,
): FinishedAttemptSummary | null {
  if (!isFinishedStatus(raw.status)) {
    return null;
  }
  const id = idOf(raw._id);
  if (!id) {
    return null;
  }

  const score = finiteNumber(raw.score, 0);
  const totalMarks = finiteNumber(raw.totalMarks, 0);
  const graded = passedAgainstMark(score, raw.passingScore);
  const startedAt = asDate(raw.startedAt);
  const submittedAt = asDate(raw.submittedAt);

  return {
    id,
    mockTestId: idOf(raw.mockTest),
    title: asLabel(raw.testTitle) ?? 'Untitled test',
    paperType: paperTypeOf(raw.paperType),
    status: raw.status,
    score,
    totalMarks: Math.max(0, totalMarks),
    percentage: toPercentage(score, totalMarks),
    correct: nonNegativeCount(raw.correct),
    incorrect: nonNegativeCount(raw.incorrect),
    unanswered: nonNegativeCount(raw.unanswered),
    totalQuestions: nonNegativeCount(raw.totalQuestions),
    passingScore: graded.passingScore,
    passed: graded.passed,
    examName: asLabel(raw.examName),
    subjectName: asLabel(raw.subjectName),
    topicName: asLabel(raw.topicName),
    timeConsumedSeconds: Math.max(0, finiteNumber(raw.timeConsumed, 0)),
    durationInMinutes: nonNegativeCount(raw.durationInMinutes),
    ...(startedAt ? { startedAt } : {}),
    ...(submittedAt ? { submittedAt } : {}),
  };
}

function mapRecent(
  rows: RawFinishedAttempt[] | null | undefined,
  paperType?: DetailPaperType,
): FinishedAttemptSummary[] {
  const attempts = (Array.isArray(rows) ? rows : [])
    .map(mapFinishedAttempt)
    .filter((attempt): attempt is FinishedAttemptSummary => attempt !== null)
    .filter(attempt => (paperType ? attempt.paperType === paperType : true))
    .sort((a, b) => attemptTimestamp(b) - attemptTimestamp(a));

  return attempts.slice(0, RECENT_FINISHED_ATTEMPT_LIMIT);
}

interface Totals {
  finishedCount: number;
  score: number;
  totalMarks: number;
  percentageSum: number;
  percentageCount: number;
  bestPercentage: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  passedCount: number;
  gradedCount: number;
}

function emptyTotals(): Totals {
  return {
    finishedCount: 0,
    score: 0,
    totalMarks: 0,
    percentageSum: 0,
    percentageCount: 0,
    bestPercentage: null,
    correct: 0,
    incorrect: 0,
    unanswered: 0,
    passedCount: 0,
    gradedCount: 0,
  };
}

function totalsFromStats(row: RawPaperStats | undefined): Totals {
  if (!row) {
    return emptyTotals();
  }
  const percentageCount = nonNegativeCount(row.percentageCount);
  const best = finiteNumber(row.bestPercentage, Number.NaN);
  return {
    finishedCount: nonNegativeCount(row.finishedCount),
    score: finiteNumber(row.totalScore, 0),
    totalMarks: Math.max(0, finiteNumber(row.totalMarks, 0)),
    percentageSum: finiteNumber(row.percentageSum, 0),
    percentageCount,
    bestPercentage: percentageCount > 0 && Number.isFinite(best) ? best : null,
    correct: nonNegativeCount(row.correct),
    incorrect: nonNegativeCount(row.incorrect),
    unanswered: nonNegativeCount(row.unanswered),
    passedCount: nonNegativeCount(row.passedCount),
    gradedCount: nonNegativeCount(row.gradedCount),
  };
}

function addTotals(left: Totals, right: Totals): Totals {
  const bests = [left.bestPercentage, right.bestPercentage].filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  return {
    finishedCount: left.finishedCount + right.finishedCount,
    score: left.score + right.score,
    totalMarks: left.totalMarks + right.totalMarks,
    percentageSum: left.percentageSum + right.percentageSum,
    percentageCount: left.percentageCount + right.percentageCount,
    bestPercentage: bests.length > 0 ? Math.max(...bests) : null,
    correct: left.correct + right.correct,
    incorrect: left.incorrect + right.incorrect,
    unanswered: left.unanswered + right.unanswered,
    passedCount: left.passedCount + right.passedCount,
    gradedCount: left.gradedCount + right.gradedCount,
  };
}

function paperPerformance(
  totals: Totals,
  recent: FinishedAttemptSummary[],
): PaperPerformance {
  if (totals.finishedCount === 0) {
    return { ...EMPTY_PAPER_PERFORMANCE };
  }

  return {
    finishedCount: totals.finishedCount,
    score: totals.score,
    totalMarks: totals.totalMarks,
    percentage: toPercentage(totals.score, totals.totalMarks),
    averagePercentage:
      totals.percentageCount > 0
        ? roundPercent(totals.percentageSum / totals.percentageCount)
        : null,
    bestPercentage:
      totals.bestPercentage == null
        ? null
        : roundPercent(totals.bestPercentage),
    latestPercentage: recent[0] ? recent[0].percentage : null,
    accuracy: accuracyPercent(totals.correct, totals.incorrect),
    correct: totals.correct,
    incorrect: totals.incorrect,
    unanswered: totals.unanswered,
    passedCount: totals.passedCount,
    gradedCount: totals.gradedCount,
    trend: performanceTrend(recent.map(attempt => attempt.percentage)),
  };
}

function statsByPaper(rows: RawPaperStats[] | null | undefined): {
  topicWise: Totals;
  fullExam: Totals;
} {
  let topicWise = emptyTotals();
  let fullExam = emptyTotals();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?._id === PaperType.FULL_EXAM) {
      fullExam = totalsFromStats(row);
    } else if (row?._id === PaperType.TOPIC_WISE) {
      topicWise = totalsFromStats(row);
    }
  }
  return { topicWise, fullExam };
}

export function mapUserPerformance(
  raw: UserPerformanceAggregate | null | undefined,
): MappedUserPerformance {
  const recentTopicWiseAttempts = mapRecent(raw?.recentTopicWise, 'TOPIC_WISE');
  const recentFullExamAttempts = mapRecent(raw?.recentFullExam, 'FULL_EXAM');
  const recentOverall =
    raw?.recentOverall == null
      ? mapRecent([
          ...(raw?.recentTopicWise ?? []),
          ...(raw?.recentFullExam ?? []),
        ])
      : mapRecent(raw.recentOverall);

  const { topicWise, fullExam } = statsByPaper(raw?.stats);

  return {
    recentTopicWiseAttempts,
    recentFullExamAttempts,
    analysis: {
      topicWise: paperPerformance(topicWise, recentTopicWiseAttempts),
      fullExam: paperPerformance(fullExam, recentFullExamAttempts),
      overall: paperPerformance(addTotals(topicWise, fullExam), recentOverall),
    },
  };
}
