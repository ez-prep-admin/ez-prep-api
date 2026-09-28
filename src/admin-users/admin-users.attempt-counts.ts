import { PipelineStage, Types } from 'mongoose';
import { PaperType } from '../common/enums/paper-type.enum';

/** Statuses analytics already treats as a completed, scored attempt. */
export const FINISHED_ATTEMPT_STATUSES = ['SUBMITTED', 'EXPIRED'] as const;

export interface AttemptActivityCounts {
  fullExamFinished: number;
  fullExamOpen: number;
  topicWiseFinished: number;
  topicWiseOpen: number;
}

export const EMPTY_ATTEMPT_ACTIVITY: AttemptActivityCounts = {
  fullExamFinished: 0,
  fullExamOpen: 0,
  topicWiseFinished: 0,
  topicWiseOpen: 0,
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
    nonNegativeCount(counts.topicWiseOpen)
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
  };
}

function statusBucket(paperIsFullExam: boolean, finished: boolean): any {
  const paperMatch = paperIsFullExam
    ? { $eq: ['$paperType', PaperType.FULL_EXAM] }
    : { $ne: ['$paperType', PaperType.FULL_EXAM] };
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
 * Missing or unknown paper types count as topic-wise. SUBMITTED and EXPIRED
 * are finished; every other status (started, in progress, paused) is open.
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
        paperType: {
          $ifNull: [
            { $arrayElemAt: ['$paper.paperType', 0] },
            PaperType.TOPIC_WISE,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$user',
        fullExamFinished: statusBucket(true, true),
        fullExamOpen: statusBucket(true, false),
        topicWiseFinished: statusBucket(false, true),
        topicWiseOpen: statusBucket(false, false),
      },
    },
  ] as PipelineStage[];
}
