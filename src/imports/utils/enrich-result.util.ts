import { EnrichError, ImportQuestion } from '../types/import-question';
import { MatchedQuestion } from '../types/matched-question';

export interface ChunkEnrichResult {
  questions: ImportQuestion[];
  errors: EnrichError[];
  enrichedIndices: number[];
}

/** Assigns stable 0-based indices when missing (e.g. legacy parse cache). */
export function ensureMatchedQuestionIndices(
  questions: MatchedQuestion[],
): MatchedQuestion[] {
  return questions.map((question, index) => ({
    ...question,
    index: question.index ?? index,
  }));
}

/**
 * Merges chunk results and drops errors for questions that ultimately enriched
 * successfully (e.g. after a later chunk retry). Uses parse index, not display
 * number, so duplicate question numbers in a paper do not collide.
 */
export function aggregateChunkEnrichResults(
  chunkResults: ChunkEnrichResult[],
): {
  questions: ImportQuestion[];
  errors: EnrichError[];
} {
  const questions: ImportQuestion[] = [];
  const errors: EnrichError[] = [];
  const enrichedIndices = new Set<number>();

  for (const result of chunkResults) {
    questions.push(...result.questions);
    errors.push(...result.errors);

    for (const index of result.enrichedIndices) {
      enrichedIndices.add(index);
    }
  }

  const unresolvedErrors = errors.filter(
    error => error.index === undefined || !enrichedIndices.has(error.index),
  );

  return { questions, errors: unresolvedErrors };
}
