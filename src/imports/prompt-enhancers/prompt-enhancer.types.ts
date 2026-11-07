import { MatchedQuestion } from '../types/matched-question';
import { PromptEnhancerId } from './prompt-enhancer.ids';

export type PromptEnhancerStage = 'enrich' | 'structure';

export interface PromptEnhancerCatalogItem {
  id: PromptEnhancerId;
  label: string;
  description: string;
}

/**
 * Pluggable additive prompt instructions for PDF import.
 * New enhancers implement this contract and register in PromptEnhancerRegistry.
 */
export interface PromptEnhancer {
  readonly id: PromptEnhancerId;
  readonly label: string;
  readonly description: string;
  readonly stages: readonly PromptEnhancerStage[];

  /** Extra system-prompt text appended during enrich when this enhancer is selected. */
  buildEnrichSystemAddon(): string;

  /** Optional extra user-prompt text appended during enrich. */
  buildEnrichUserAddon?(): string | undefined;

  /**
   * Optional hard cap on questions per enrich LLM chunk when this enhancer is active.
   * Applied as Math.min with the thinking / default enrich caps.
   * Use when the enhancer inflates output size (e.g. repeating a shared passage).
   */
  readonly maxQuestionsPerEnrichChunk?: number;

  /**
   * Optional deterministic rewrite of matched questions before enrich chunking.
   * Default: identity (no-op).
   */
  prepareMatchedQuestions?(
    matchedQuestions: MatchedQuestion[],
  ): MatchedQuestion[];

  /** Optional structure-detection system addon for future enhancers. */
  buildStructureSystemAddon?(): string;
}
