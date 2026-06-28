import { Injectable } from '@nestjs/common';
import { MatchedQuestion } from '../types/matched-question';

export interface QuestionChunk {
  chunkIndex: number;
  questions: MatchedQuestion[];
}

@Injectable()
export class QuestionChunkerService {
  /**
   * Splits matched questions into chunks for LLM calls.
   * Default chunk size sends all questions in a single request (debug/MVP mode).
   * Reduce chunkSize later for large papers (100–500 questions).
   */
  chunk(
    questions: MatchedQuestion[],
    chunkSize = questions.length,
  ): QuestionChunk[] {
    if (questions.length === 0) {
      return [];
    }

    const size = Math.max(1, chunkSize);
    const chunks: QuestionChunk[] = [];

    for (let index = 0; index < questions.length; index += size) {
      chunks.push({
        chunkIndex: chunks.length,
        questions: questions.slice(index, index + size),
      });
    }

    return chunks;
  }
}
