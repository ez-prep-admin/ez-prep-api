import { Types } from 'mongoose';
import { PaperType } from '../common/enums/paper-type.enum';
import {
  buildUserPerformancePipeline,
  mapFinishedAttempt,
  mapUserPerformance,
  performanceTrend,
  PERFORMANCE_TREND_THRESHOLD,
  RawFinishedAttempt,
  RECENT_FINISHED_ATTEMPT_LIMIT,
  toPercentage,
} from './admin-users.performance';

function attempt(
  overrides: RawFinishedAttempt & { submittedAt?: Date } = {},
): RawFinishedAttempt {
  return {
    _id: overrides._id ?? new Types.ObjectId().toHexString(),
    mockTest: 'test-1',
    testTitle: 'Polity set',
    paperType: PaperType.TOPIC_WISE,
    status: 'SUBMITTED',
    score: 40,
    totalMarks: 100,
    correct: 40,
    incorrect: 10,
    unanswered: 0,
    totalQuestions: 50,
    passingScore: 35,
    examName: 'UPSC',
    subjectName: 'Polity',
    topicName: 'Constitution',
    timeConsumed: 1200,
    durationInMinutes: 60,
    startedAt: new Date('2026-03-01T10:00:00.000Z'),
    submittedAt: new Date('2026-03-01T11:00:00.000Z'),
    ...overrides,
  };
}

describe('buildUserPerformancePipeline', () => {
  const userId = new Types.ObjectId();
  const pipeline = buildUserPerformancePipeline(userId);
  const serialized = JSON.stringify(pipeline);

  it('scores only finished attempts for that learner', () => {
    expect(pipeline[0]).toEqual({
      $match: {
        user: userId,
        status: { $in: ['SUBMITTED', 'EXPIRED'] },
      },
    });
    expect(serialized).not.toContain('IN_PROGRESS');
    expect(serialized).not.toContain('PAUSED');
  });

  it('caps each recent list at five finished attempts', () => {
    const facet = pipeline.find(
      stage => stage && typeof stage === 'object' && '$facet' in stage,
    ) as unknown as { $facet: Record<string, Array<Record<string, unknown>>> };

    expect(facet.$facet.recentTopicWise).toEqual(
      expect.arrayContaining([{ $limit: RECENT_FINISHED_ATTEMPT_LIMIT }]),
    );
    expect(facet.$facet.recentFullExam).toEqual(
      expect.arrayContaining([{ $limit: RECENT_FINISHED_ATTEMPT_LIMIT }]),
    );
    expect(facet.$facet.recentOverall).toEqual([
      { $limit: RECENT_FINISHED_ATTEMPT_LIMIT },
    ]);
    expect(RECENT_FINISHED_ATTEMPT_LIMIT).toBe(5);
    expect(serialized.match(/"\$limit":5/g)).toHaveLength(3);
  });

  it('reads paper type and related names, and keeps unknown papers topic-wise', () => {
    expect(serialized).toContain('"from":"mocktests"');
    expect(serialized).toContain('"from":"exams"');
    expect(serialized).toContain('"from":"subjects"');
    expect(serialized).toContain('"from":"topics"');
    expect(serialized).toContain(PaperType.TOPIC_WISE);
    expect(serialized).toContain('selectedOption');
    expect(serialized).toContain('marksPerQuestion');
  });
});

describe('toPercentage', () => {
  it('returns null when there are no marks to score against', () => {
    expect(toPercentage(10, 0)).toBeNull();
    expect(toPercentage(10, -5)).toBeNull();
    expect(toPercentage(Number.NaN, 10)).toBeNull();
  });

  it('rounds score out of total marks to one decimal', () => {
    expect(toPercentage(1, 3)).toBe(33.3);
    expect(toPercentage(42, 100)).toBe(42);
    expect(toPercentage(-5, 100)).toBe(-5);
  });
});

describe('performanceTrend', () => {
  it('needs two scored attempts', () => {
    expect(performanceTrend([])).toBe('insufficient');
    expect(performanceTrend([40])).toBe('insufficient');
    expect(performanceTrend([null, null])).toBe('insufficient');
  });

  it('compares the latest scored test with the oldest scored test in the window', () => {
    expect(performanceTrend([80, 70])).toBe('improving');
    expect(performanceTrend([70, 80])).toBe('declining');
    expect(performanceTrend([70 + PERFORMANCE_TREND_THRESHOLD - 0.1, 70])).toBe(
      'steady',
    );
    expect(performanceTrend([null, 90, 70])).toBe('improving');
  });
});

describe('mapFinishedAttempt', () => {
  it('keeps score, marks, and a pass result', () => {
    const mapped = mapFinishedAttempt(
      attempt({ score: 42.5, totalMarks: 100 }),
    );

    expect(mapped).toMatchObject({
      title: 'Polity set',
      paperType: 'TOPIC_WISE',
      status: 'SUBMITTED',
      score: 42.5,
      totalMarks: 100,
      percentage: 42.5,
      passed: true,
      passingScore: 35,
      examName: 'UPSC',
      subjectName: 'Polity',
      topicName: 'Constitution',
    });
  });

  it('drops open attempts and rows without an id', () => {
    expect(mapFinishedAttempt(attempt({ status: 'IN_PROGRESS' }))).toBeNull();
    expect(mapFinishedAttempt(attempt({ status: 'PAUSED' }))).toBeNull();
    expect(mapFinishedAttempt(attempt({ _id: '' }))).toBeNull();
    expect(
      mapFinishedAttempt(attempt({ _id: undefined, status: 'SUBMITTED' })),
    ).toBeNull();
  });

  it('treats a missing or zero pass mark as ungraded and zero total marks as no percentage', () => {
    expect(
      mapFinishedAttempt(attempt({ passingScore: 0, score: 10 })),
    ).toMatchObject({ passed: null, passingScore: null });
    expect(
      mapFinishedAttempt(attempt({ passingScore: null, score: 10 })),
    ).toMatchObject({ passed: null });
    expect(
      mapFinishedAttempt(attempt({ totalMarks: 0, score: 4 })),
    ).toMatchObject({ percentage: null, totalMarks: 0, score: 4 });
  });

  it('marks a finished attempt as not passed when the score is short', () => {
    expect(
      mapFinishedAttempt(
        attempt({ score: 10, passingScore: 35, status: 'EXPIRED' }),
      ),
    ).toMatchObject({ status: 'EXPIRED', passed: false, percentage: 10 });
  });

  it('falls back when the title or marks are missing', () => {
    expect(
      mapFinishedAttempt(
        attempt({
          testTitle: '  ',
          score: 'nope',
          totalMarks: undefined,
          paperType: 'FULL_EXAM',
          examName: '',
        }),
      ),
    ).toMatchObject({
      title: 'Untitled test',
      score: 0,
      totalMarks: 0,
      percentage: null,
      paperType: 'FULL_EXAM',
      examName: null,
    });
  });
});

describe('mapUserPerformance', () => {
  it('returns an empty analysis when the learner has no finished attempts', () => {
    const mapped = mapUserPerformance(undefined);

    expect(mapped.recentTopicWiseAttempts).toEqual([]);
    expect(mapped.recentFullExamAttempts).toEqual([]);
    expect(mapped.analysis.topicWise).toMatchObject({
      finishedCount: 0,
      percentage: null,
      accuracy: null,
      trend: 'insufficient',
    });
    expect(mapped.analysis.fullExam.finishedCount).toBe(0);
    expect(mapped.analysis.overall.finishedCount).toBe(0);
  });

  it('keeps only the five newest finished attempts per paper type', () => {
    const topic = Array.from({ length: 6 }, (_, index) =>
      attempt({
        _id: `topic-${index}`,
        submittedAt: new Date(Date.UTC(2026, 0, index + 1)),
        score: index * 10,
        totalMarks: 100,
        passingScore: null,
      }),
    );
    const mapped = mapUserPerformance({
      recentTopicWise: topic,
      recentFullExam: [],
      recentOverall: topic.slice(-5).reverse(),
      stats: [
        {
          _id: 'TOPIC_WISE',
          finishedCount: 6,
          totalScore: 150,
          totalMarks: 600,
          percentageSum: 150,
          percentageCount: 6,
          bestPercentage: 50,
          correct: 12,
          incorrect: 4,
          unanswered: 2,
          passedCount: 0,
          gradedCount: 0,
        },
      ],
    });

    expect(mapped.recentTopicWiseAttempts).toHaveLength(5);
    expect(mapped.recentTopicWiseAttempts.map(row => row.id)).toEqual([
      'topic-5',
      'topic-4',
      'topic-3',
      'topic-2',
      'topic-1',
    ]);
    expect(mapped.recentFullExamAttempts).toEqual([]);
    expect(mapped.analysis.topicWise).toMatchObject({
      finishedCount: 6,
      score: 150,
      totalMarks: 600,
      percentage: 25,
      averagePercentage: 25,
      bestPercentage: 50,
      latestPercentage: 50,
      accuracy: 75,
      correct: 12,
      incorrect: 4,
      unanswered: 2,
      trend: 'improving',
    });
    expect(mapped.analysis.fullExam.finishedCount).toBe(0);
    expect(mapped.analysis.overall.finishedCount).toBe(6);
  });

  it('analyses full mocks separately and still returns a short list', () => {
    const mapped = mapUserPerformance({
      recentTopicWise: [
        attempt({ _id: 't1', score: 8, totalMarks: 10, passingScore: null }),
      ],
      recentFullExam: [
        attempt({
          _id: 'f1',
          testTitle: 'Full mock 1',
          paperType: 'FULL_EXAM',
          score: 90,
          totalMarks: 200,
          correct: 90,
          incorrect: 30,
          unanswered: 10,
          passingScore: 80,
          submittedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
        attempt({
          _id: 'f2',
          testTitle: 'Full mock 2',
          paperType: 'FULL_EXAM',
          score: 120,
          totalMarks: 200,
          passingScore: 80,
          submittedAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
      ],
      recentOverall: [
        attempt({
          _id: 'f1',
          paperType: 'FULL_EXAM',
          score: 90,
          totalMarks: 200,
          submittedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
        attempt({
          _id: 't1',
          score: 8,
          totalMarks: 10,
          submittedAt: new Date('2026-04-01T12:00:00.000Z'),
        }),
      ],
      stats: [
        {
          _id: 'TOPIC_WISE',
          finishedCount: 1,
          totalScore: 8,
          totalMarks: 10,
          percentageSum: 80,
          percentageCount: 1,
          bestPercentage: 80,
          correct: 8,
          incorrect: 2,
          unanswered: 0,
          passedCount: 0,
          gradedCount: 0,
        },
        {
          _id: 'FULL_EXAM',
          finishedCount: 2,
          totalScore: 210,
          totalMarks: 400,
          percentageSum: 45 + 60,
          percentageCount: 2,
          bestPercentage: 60,
          correct: 180,
          incorrect: 40,
          unanswered: 10,
          passedCount: 1,
          gradedCount: 2,
        },
      ],
    });

    expect(mapped.recentTopicWiseAttempts).toHaveLength(1);
    expect(mapped.recentFullExamAttempts.map(row => row.title)).toEqual([
      'Full mock 1',
      'Full mock 2',
    ]);
    expect(mapped.analysis.fullExam).toMatchObject({
      finishedCount: 2,
      score: 210,
      totalMarks: 400,
      percentage: 52.5,
      averagePercentage: 52.5,
      bestPercentage: 60,
      latestPercentage: 45,
      passedCount: 1,
      gradedCount: 2,
      trend: 'declining',
    });
    expect(mapped.analysis.overall).toMatchObject({
      finishedCount: 3,
      score: 218,
      totalMarks: 410,
      bestPercentage: 80,
      passedCount: 1,
      gradedCount: 2,
    });
    expect(mapped.analysis.overall.percentage).toBe(toPercentage(218, 410));
  });

  it('drops leaked open attempts and attempts that landed in the wrong list', () => {
    const mapped = mapUserPerformance({
      recentTopicWise: [
        attempt({ _id: 'open', status: 'IN_PROGRESS' }),
        attempt({ _id: 'full-in-topic', paperType: 'FULL_EXAM' }),
        attempt({ _id: 'kept' }),
      ],
      recentFullExam: [
        attempt({ _id: 'topic-in-full', paperType: 'TOPIC_WISE' }),
      ],
      stats: [],
    });

    expect(mapped.recentTopicWiseAttempts.map(row => row.id)).toEqual(['kept']);
    expect(mapped.recentFullExamAttempts).toEqual([]);
  });

  it('builds overall recent form from the two lists when the overall window is missing', () => {
    const mapped = mapUserPerformance({
      recentTopicWise: [
        attempt({
          _id: 't-new',
          score: 90,
          totalMarks: 100,
          submittedAt: new Date('2026-05-02T00:00:00.000Z'),
        }),
      ],
      recentFullExam: [
        attempt({
          _id: 'f-old',
          paperType: 'FULL_EXAM',
          score: 40,
          totalMarks: 100,
          submittedAt: new Date('2026-05-01T00:00:00.000Z'),
        }),
      ],
      stats: [
        {
          _id: 'TOPIC_WISE',
          finishedCount: 1,
          totalScore: 90,
          totalMarks: 100,
          percentageSum: 90,
          percentageCount: 1,
          bestPercentage: 90,
          correct: 1,
          incorrect: 0,
          unanswered: 0,
          passedCount: 0,
          gradedCount: 0,
        },
        {
          _id: 'FULL_EXAM',
          finishedCount: 1,
          totalScore: 40,
          totalMarks: 100,
          percentageSum: 40,
          percentageCount: 1,
          bestPercentage: 40,
          correct: 1,
          incorrect: 1,
          unanswered: 0,
          passedCount: 0,
          gradedCount: 0,
        },
      ],
    });

    expect(mapped.analysis.overall.latestPercentage).toBe(90);
    expect(mapped.analysis.overall.trend).toBe('improving');
    expect(mapped.analysis.overall.accuracy).toBe(66.7);
  });
});
