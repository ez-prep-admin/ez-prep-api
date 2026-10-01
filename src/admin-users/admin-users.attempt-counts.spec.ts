import { PaperType } from '../common/enums/paper-type.enum';
import {
  buildAttemptActivityPipeline,
  EMPTY_ATTEMPT_ACTIVITY,
  FINISHED_ATTEMPT_STATUSES,
  normalizeAttemptActivity,
  totalAttempts,
} from './admin-users.attempt-counts';

describe('normalizeAttemptActivity', () => {
  it('clamps missing, negative, and non-finite buckets to zero', () => {
    expect(normalizeAttemptActivity(undefined)).toEqual(EMPTY_ATTEMPT_ACTIVITY);
    expect(normalizeAttemptActivity(null)).toEqual(EMPTY_ATTEMPT_ACTIVITY);
    expect(
      normalizeAttemptActivity({
        fullExamFinished: -4,
        fullExamOpen: Number.NaN,
        topicWiseFinished: 2.8,
        topicWiseOpen: Infinity,
      }),
    ).toEqual({
      fullExamFinished: 0,
      fullExamOpen: 0,
      topicWiseFinished: 2,
      topicWiseOpen: 0,
      sprintFinished: 0,
      sprintOpen: 0,
    });
  });
});

describe('totalAttempts', () => {
  it('sums every paper-type bucket after clamping', () => {
    expect(
      totalAttempts({
        fullExamFinished: 4,
        fullExamOpen: 1,
        topicWiseFinished: 2,
        topicWiseOpen: 3,
        sprintFinished: 5,
        sprintOpen: 1,
      }),
    ).toBe(16);
    expect(totalAttempts(EMPTY_ATTEMPT_ACTIVITY)).toBe(0);
  });
});

describe('buildAttemptActivityPipeline', () => {
  it('joins mocktests and splits FULL_EXAM from topic-wise, finished from open', () => {
    const userId = '507f1f77bcf86cd799439011' as any;
    const pipeline = buildAttemptActivityPipeline([userId]);

    expect(pipeline[0]).toEqual({ $match: { user: { $in: [userId] } } });
    expect(pipeline[1]).toEqual({
      $lookup: {
        from: 'mocktests',
        localField: 'mockTest',
        foreignField: '_id',
        as: 'paper',
      },
    });
    expect(JSON.stringify(pipeline[3])).toContain(PaperType.TOPIC_WISE);
    expect(JSON.stringify(pipeline[3])).toContain(PaperType.FULL_EXAM);
    expect(JSON.stringify(pipeline[3])).toContain(PaperType.SPRINT);
    for (const status of FINISHED_ATTEMPT_STATUSES) {
      expect(JSON.stringify(pipeline[3])).toContain(status);
    }
  });
});
