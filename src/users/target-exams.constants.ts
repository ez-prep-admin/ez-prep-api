/** Ordered target exams. The first one is the primary exam. */
export const MAX_TARGET_EXAMS = 5;

/** After this many dismissals we stop asking about that exam. */
export const MAX_TARGET_EXAM_PROMPT_DISMISSALS = 3;

/** Wait this long after "Not now" before asking about the same exam again. */
export const TARGET_EXAM_PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
