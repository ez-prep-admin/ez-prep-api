/**
 * Stable prompt-enhancer slugs. Keep in sync with the registry implementations.
 * Used by DTOs for `@IsIn` validation without circular Nest DI.
 */
export const SHARED_PASSAGE_ENHANCER_ID = 'shared-passage' as const;
export const MULTI_CORRECT_STATEMENTS_ENHANCER_ID =
  'multi-correct-statements' as const;

export const PROMPT_ENHANCER_IDS = [
  SHARED_PASSAGE_ENHANCER_ID,
  MULTI_CORRECT_STATEMENTS_ENHANCER_ID,
] as const;

export type PromptEnhancerId = (typeof PROMPT_ENHANCER_IDS)[number];
