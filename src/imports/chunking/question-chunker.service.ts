import { Injectable, Logger } from '@nestjs/common';
import { MatchedQuestion } from '../types/matched-question';

export interface QuestionChunk {
  chunkIndex: number;
  questions: MatchedQuestion[];
  estimatedTokens?: number;
  retryCount?: number;
  status?: 'pending' | 'processing' | 'success' | 'failed';
}

export interface ChunkingOptions {
  /**
   * Maximum tokens per chunk (default: 20000 for safety with 32K context models)
   */
  maxTokensPerChunk?: number;

  /**
   * Minimum questions per chunk (default: 10 to avoid too many tiny chunks)
   */
  minQuestionsPerChunk?: number;

  /**
   * Maximum questions per chunk (default: 100 as hard cap)
   */
  maxQuestionsPerChunk?: number;

  /**
   * Fixed chunk size (overrides token-based chunking if set)
   */
  fixedChunkSize?: number;
}

@Injectable()
export class QuestionChunkerService {
  private readonly logger = new Logger(QuestionChunkerService.name);

  /**
   * Default chunking configuration
   */
  private readonly defaultOptions: Required<Omit<ChunkingOptions, 'fixedChunkSize'>> = {
    maxTokensPerChunk: 20000,
    minQuestionsPerChunk: 10,
    maxQuestionsPerChunk: 100,
  };

  /**
   * Splits matched questions into chunks for LLM calls.
   * 
   * @param questions Array of matched questions to chunk
   * @param chunkSize Legacy parameter for fixed chunk size (default: all questions)
   * @returns Array of question chunks with metadata
   * 
   * @deprecated Use chunkByTokenLimit() for adaptive chunking
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
      const questionSlice = questions.slice(index, index + size);
      chunks.push({
        chunkIndex: chunks.length,
        questions: questionSlice,
        estimatedTokens: this.estimateTokens(
          questionSlice.map(q => q.question + (q.solution ?? '')).join('\n'),
        ),
        retryCount: 0,
        status: 'pending',
      });
    }

    return chunks;
  }

  /**
   * Chunk questions adaptively based on estimated token count
   * 
   * @param questions Array of matched questions to chunk
   * @param options Chunking configuration options
   * @returns Array of question chunks optimized for token limits
   */
  chunkByTokenLimit(
    questions: MatchedQuestion[],
    options: ChunkingOptions = {},
  ): QuestionChunk[] {
    if (questions.length === 0) {
      return [];
    }

    const config = { ...this.defaultOptions, ...options };

    // If fixed chunk size is specified, use legacy behavior
    if (options.fixedChunkSize !== undefined) {
      this.logger.log(
        `[chunker] Using fixed chunk size: ${options.fixedChunkSize}`,
      );
      return this.chunk(questions, options.fixedChunkSize);
    }

    const chunks: QuestionChunk[] = [];
    let currentChunk: MatchedQuestion[] = [];
    let currentTokens = 0;

    for (const question of questions) {
      const questionText = question.question + (question.solution ?? '');
      const questionTokens = this.estimateTokens(questionText);

      // Check if adding this question would exceed limits
      const wouldExceedTokens =
        currentTokens + questionTokens > config.maxTokensPerChunk;
      const wouldExceedMaxQuestions =
        currentChunk.length >= config.maxQuestionsPerChunk;

      if (
        currentChunk.length > 0 &&
        (wouldExceedTokens || wouldExceedMaxQuestions)
      ) {
        // Flush current chunk if it meets minimum size
        if (currentChunk.length >= config.minQuestionsPerChunk) {
          chunks.push({
            chunkIndex: chunks.length,
            questions: currentChunk,
            estimatedTokens: currentTokens,
            retryCount: 0,
            status: 'pending',
          });
          currentChunk = [];
          currentTokens = 0;
        }
      }

      // Add question to current chunk
      currentChunk.push(question);
      currentTokens += questionTokens;
    }

    // Flush remaining questions
    if (currentChunk.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        questions: currentChunk,
        estimatedTokens: currentTokens,
        retryCount: 0,
        status: 'pending',
      });
    }

    this.logger.log(
      `[chunker] Created ${chunks.length} chunk(s) from ${questions.length} question(s)`,
    );
    chunks.forEach((chunk, index) => {
      this.logger.debug(
        `[chunker] Chunk ${index}: ${chunk.questions.length} questions, ~${chunk.estimatedTokens} tokens`,
      );
    });

    return chunks;
  }

  /**
   * Estimate token count for a text string
   * Uses rough approximation: characters / 4
   * 
   * @param text Text to estimate tokens for
   * @returns Estimated number of tokens
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    // Rough approximation: 1 token ≈ 4 characters for English text
    // This is a conservative estimate that works reasonably well
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate total estimated tokens for all questions
   * 
   * @param questions Array of matched questions
   * @returns Total estimated token count
   */
  estimateTotalTokens(questions: MatchedQuestion[]): number {
    return questions.reduce((total, question) => {
      const text = question.question + (question.solution ?? '');
      return total + this.estimateTokens(text);
    }, 0);
  }

  /**
   * Get chunking statistics for a set of questions
   * 
   * @param questions Array of matched questions
   * @param options Chunking configuration
   * @returns Statistics about how questions would be chunked
   */
  getChunkingStats(
    questions: MatchedQuestion[],
    options: ChunkingOptions = {},
  ): {
    totalQuestions: number;
    totalTokens: number;
    estimatedChunks: number;
    avgQuestionsPerChunk: number;
    avgTokensPerChunk: number;
  } {
    const totalQuestions = questions.length;
    const totalTokens = this.estimateTotalTokens(questions);
    const chunks = this.chunkByTokenLimit(questions, options);

    return {
      totalQuestions,
      totalTokens,
      estimatedChunks: chunks.length,
      avgQuestionsPerChunk:
        chunks.length > 0
          ? Math.round(totalQuestions / chunks.length)
          : 0,
      avgTokensPerChunk:
        chunks.length > 0
          ? Math.round(totalTokens / chunks.length)
          : 0,
    };
  }
}
