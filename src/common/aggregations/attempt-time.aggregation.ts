/**
 * Time spent on a mock test attempt, in seconds, for use inside aggregations.
 *
 * `timeConsumed` on the attempt root is the authoritative value: it is frozen on
 * pause, on session completion and on submit/expiry, and for session-wise full
 * mocks it holds the sum of every section timer.
 *
 * Attempts that were closed before that value was persisted hold 0, so fall back
 * to the sum of the session timers and then to the wall clock between start and
 * submission, capped at the paper duration so an abandoned attempt cannot report
 * days of study time.
 */
export const EFFECTIVE_TIME_CONSUMED_EXPR = {
  $let: {
    vars: {
      sessionTotal: {
        $sum: {
          $map: {
            input: { $ifNull: ['$sessions', []] },
            as: 'session',
            in: {
              $min: [
                { $ifNull: ['$$session.timeConsumed', 0] },
                {
                  $multiply: [
                    { $ifNull: ['$$session.durationInMinutes', 0] },
                    60,
                  ],
                },
              ],
            },
          },
        },
      },
      wallClockSeconds: {
        $min: [
          {
            $max: [
              0,
              {
                $divide: [
                  {
                    $subtract: [
                      { $ifNull: ['$submittedAt', '$startedAt'] },
                      '$startedAt',
                    ],
                  },
                  1000,
                ],
              },
            ],
          },
          { $multiply: [{ $ifNull: ['$durationInMinutes', 0] }, 60] },
        ],
      },
    },
    in: {
      $cond: [
        { $gt: [{ $ifNull: ['$timeConsumed', 0] }, 0] },
        '$timeConsumed',
        {
          $cond: [
            { $gt: ['$$sessionTotal', 0] },
            '$$sessionTotal',
            '$$wallClockSeconds',
          ],
        },
      ],
    },
  },
};
