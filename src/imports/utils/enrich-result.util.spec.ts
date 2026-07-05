import {
  aggregateChunkEnrichResults,
  ensureMatchedQuestionIndices,
} from './enrich-result.util';
import { EnrichError } from '../types/import-question';
import { MatchedQuestion } from '../types/matched-question';

describe('enrich-result.util', () => {
  it('assigns indices to matched questions when missing', () => {
    const questions: MatchedQuestion[] = [
      { number: 1, question: 'Q1' },
      { number: 2, question: 'Q2' },
    ];

    expect(ensureMatchedQuestionIndices(questions)).toEqual([
      { number: 1, question: 'Q1', index: 0 },
      { number: 2, question: 'Q2', index: 1 },
    ]);
  });

  it('preserves existing indices on matched questions', () => {
    const questions: MatchedQuestion[] = [
      { number: 1, question: 'Q1', index: 10 },
    ];

    expect(ensureMatchedQuestionIndices(questions)[0].index).toBe(10);
  });

  it('drops duplicate error entries when the same parse index was enriched', () => {
    const staleError: EnrichError = {
      index: 0,
      number: 1,
      stage: 'llm',
      message: 'Stale intermediate failure',
    };

    const { errors } = aggregateChunkEnrichResults([
      {
        questions: [{} as never],
        errors: [staleError],
        enrichedIndices: [0],
      },
    ]);

    expect(errors).toHaveLength(0);
  });

  it('keeps errors when duplicate display numbers refer to different parse indices', () => {
    const sectionAError: EnrichError = {
      index: 0,
      number: 1,
      stage: 'llm',
      message: 'Chunk 0 failed after 3 attempts',
    };

    const { errors } = aggregateChunkEnrichResults([
      {
        questions: [],
        errors: [sectionAError],
        enrichedIndices: [],
      },
      {
        questions: [{} as never],
        errors: [],
        enrichedIndices: [20],
      },
    ]);

    expect(errors).toEqual([sectionAError]);
  });
});
