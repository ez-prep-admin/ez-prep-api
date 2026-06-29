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
});
