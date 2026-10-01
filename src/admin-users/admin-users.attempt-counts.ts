import { PipelineStage, Types } from 'mongoose';
import { PaperType } from '../common/enums/paper-type.enum';

/** Statuses analytics already treats as a completed, scored attempt. */
export const FINISHED_ATTEMPT_STATUSES = ['SUBMITTED', 'EXPIRED'] as const;

export interface AttemptActivityCounts {
  fullExamFinished: number;
  fullExamOpen: number;
  topicWiseFinished: number;
  topicWiseOpen: number;
  sprintFinished: number;
  sprintOpen: number;
}

export const EMPTY_ATTEMPT_ACTIVITY: AttemptActivityCounts = {
  fullExamFinished: 0,
  fullExamOpen: 0,
  topicWiseFinished: 0,
  topicWiseOpen: 0,
  sprintFinished: 0,
  sprintOpen: 0,
};

export function nonNegativeCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.trunc(n));
}

export function totalAttempts(counts: AttemptActivityCounts): number {
  return (
    nonNegativeCount(counts.fullExamFinished) +
    nonNegativeCount(counts.fullExamOpen) +
    nonNegativeCount(counts.topicWiseFinished) +
    nonNegativeCount(counts.topicWiseOpen) +
    nonNegativeCount(counts.sprintFinished) +
    nonNegativeCount(counts.sprintOpen)
  );
}

export function normalizeAttemptActivity(
  row: Partial<AttemptActivityCounts> | null | undefined,
): AttemptActivityCounts {
  return {
    fullExamFinished: nonNegativeCount(row?.fullExamFinished),
    fullExamOpen: nonNegativeCount(row?.fullExamOpen),
    topicWiseFinished: nonNegativeCount(row?.topicWiseFinished),
    topicWiseOpen: nonNegativeCount(row?.topicWiseOpen),
    sprintFinished: nonNegativeCount(row?.sprintFinished),
    sprintOpen: nonNegativeCount(row?.sprintOpen),
  };
}

function statusBucket(
  paperMatch: Record<string, unknown>,
  finished: boolean,
): any {
  const statusMatch = finished
    ? { $in: ['$status', [...FINISHED_ATTEMPT_STATUSES]] }
    : { $not: [{ $in: ['$status', [...FINISHED_ATTEMPT_STATUSES]] }] };

  return {
    $sum: {
      $cond: [{ $and: [paperMatch, statusMatch] }, 1, 0],
    },
  };
}

/**
 * Counts attempts for the given learners, joined to `mocktests.paperType`.
 * Each bucket matches that paper type exactly. SUBMITTED and EXPIRED are
 * finished; every other status (started, in progress, paused) is open.
 */
export function buildAttemptActivityPipeline(
  userIds: Types.ObjectId[],
): PipelineStage[] {
  return [
    { $match: { user: { $in: userIds } } },
    {
      $lookup: {
        from: 'mocktests',
        localField: 'mockTest',
        foreignField: '_id',
        as: 'paper',
      },
    },
    {
      $addFields: {
        paperType: { $arrayElemAt: ['$paper.paperType', 0] },
      },
    },
    {
      $group: {
        _id: '$user',
        fullExamFinished: statusBucket(
          { $eq: ['$paperType', PaperType.FULL_EXAM] },
          true,
        ),
        fullExamOpen: statusBucket(
          { $eq: ['$paperType', PaperType.FULL_EXAM] },
          false,
        ),
        sprintFinished: statusBucket(
          { $eq: ['$paperType', PaperType.SPRINT] },
          true,
        ),
        sprintOpen: statusBucket(
          { $eq: ['$paperType', PaperType.SPRINT] },
          false,
        ),
        topicWiseFinished: statusBucket(
          { $eq: ['$paperType', PaperType.TOPIC_WISE] },
          true,
        ),
        topicWiseOpen: statusBucket(
          { $eq: ['$paperType', PaperType.TOPIC_WISE] },
          false,
        ),
      },
    },
  ] as PipelineStage[];
}
