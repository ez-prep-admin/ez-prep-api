import { QuestionChunkerService } from './question-chunker.service';
import { MatchedQuestion } from '../types/matched-question';

describe('QuestionChunkerService', () => {
  const chunker = new QuestionChunkerService();

  it('splits questions when token budget would be exceeded', () => {
    const questions: MatchedQuestion[] = Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      question: 'x'.repeat(6000),
      solution: 'y'.repeat(2000),
    }));

    const chunks = chunker.chunkByTokenLimit(questions, {
      maxTokensPerChunk: 5000,
      promptOverheadTokens: 500,
      maxQuestionsPerChunk: 50,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap(chunk => chunk.questions)).toHaveLength(12);
  });

  it('keeps small papers in a single chunk', () => {
    const questions: MatchedQuestion[] = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      question: `Question ${i + 1}`,
      solution: `Solution ${i + 1}`,
    }));

    const chunks = chunker.chunkByTokenLimit(questions);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].questions).toHaveLength(5);
  });

  it('respects maxQuestionsPerChunk even when token budget allows more', () => {
    const questions: MatchedQuestion[] = Array.from({ length: 46 }, (_, i) => ({
      number: i + 1,
      question: `Question ${i + 1}`,
      solution: `Solution ${i + 1}`,
    }));

    const chunks = chunker.chunkByTokenLimit(questions, {
      maxQuestionsPerChunk: 20,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks.map(chunk => chunk.questions.length)).toEqual([20, 20, 6]);
  });

  it('returns empty arrays for empty input', () => {
    expect(chunker.chunk([])).toEqual([]);
    expect(chunker.chunkByTokenLimit([])).toEqual([]);
  });

  it('uses fixedChunkSize when provided', () => {
    const questions: MatchedQuestion[] = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      question: `Q${i + 1}`,
    }));

    const chunks = chunker.chunkByTokenLimit(questions, { fixedChunkSize: 2 });
    expect(chunks.map(chunk => chunk.questions.length)).toEqual([2, 2, 1]);
  });

  it('isolates a single question that exceeds the input budget', () => {
    const questions: MatchedQuestion[] = [
      { number: 1, question: 'x'.repeat(20_000) },
      { number: 2, question: 'short' },
    ];

    const chunks = chunker.chunkByTokenLimit(questions, {
      maxTokensPerChunk: 2000,
      promptOverheadTokens: 500,
    });

    expect(chunks[0].questions).toHaveLength(1);
    expect(chunks[0].questions[0].number).toBe(1);
  });

  it('merges a tiny trailing chunk when it still fits the budget', () => {
    const questions: MatchedQuestion[] = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      question: i < 4 ? 'x'.repeat(800) : 'tail',
    }));

    const chunks = chunker.chunkByTokenLimit(questions, {
      minQuestionsPerChunk: 3,
      maxQuestionsPerChunk: 50,
      maxTokensPerChunk: 900,
      promptOverheadTokens: 0,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].questions).toHaveLength(5);
  });

  it('reports zero averages when getChunkingStats has no questions', () => {
    const stats = chunker.getChunkingStats([]);
    expect(stats.estimatedChunks).toBe(0);
    expect(stats.avgQuestionsPerChunk).toBe(0);
    expect(stats.avgTokensPerChunk).toBe(0);
    expect(stats.chunks).toEqual([]);
  });

  it('estimateTokens treats empty text as zero', () => {
    expect(chunker.estimateTokens('')).toBe(0);
  });
});
