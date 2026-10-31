export const FEEDBACK_RATING_KEYS = [
  'userInterface',
  'questions',
  'fullMockTests',
  'topicWisePractice',
  'easeOfUse',
] as const;

export type FeedbackRatingKey = (typeof FEEDBACK_RATING_KEYS)[number];

export type FeedbackRatings = Partial<Record<FeedbackRatingKey, number>>;

export const FEEDBACK_TEXT_MAX = 1000;
export const FEEDBACK_DEFAULT_LIMIT = 10;
export const FEEDBACK_MAX_LIMIT = 100;

export function clampPage(page: number): number {
  if (!Number.isFinite(page)) {
    return 1;
  }
  return Math.max(1, Math.trunc(page));
}

export function clampLimit(limit: number, max = FEEDBACK_MAX_LIMIT): number {
  if (!Number.isFinite(limit)) {
    return FEEDBACK_DEFAULT_LIMIT;
  }
  return Math.min(Math.max(1, Math.trunc(limit)), max);
}

/** One decimal, half away from zero via Math.round. */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
