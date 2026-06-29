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
   * Maximum tokens per chunk including prompt overhead (default: 20000)
   */
  maxTokensPerChunk?: number;

  /**
   * Reserved tokens for system prompt, JSON schema, and response headroom
   */
  promptOverheadTokens?: number;

  /**
   * Prefer merging trailing chunks below this size when safe (default: 5)
   */
  minQuestionsPerChunk?: number;

  /**
   * Maximum questions per chunk (default: 50)
   */
  maxQuestionsPerChunk?: number;

  /**
   * Fixed chunk size (overrides token-based chunking if set)
   */
  fixedChunkSize?: number;
}

/** Default max tokens for DeepSeek 32K context with response headroom */
export const DEFAULT_MAX_TOKENS_PER_CHUNK = 20000;
export const DEFAULT_PROMPT_OVERHEAD_TOKENS = 4000;

@Injectable()
export class QuestionChunkerService {
  private readonly logger = new Logger(QuestionChunkerService.name);

  private readonly defaultOptions: Required<
    Omit<ChunkingOptions, 'fixedChunkSize'>
  > = {
    maxTokensPerChunk: DEFAULT_MAX_TOKENS_PER_CHUNK,
    promptOverheadTokens: DEFAULT_PROMPT_OVERHEAD_TOKENS,
    minQuestionsPerChunk: 5,
    maxQuestionsPerChunk: 50,
  };

  /**
   * Splits matched questions into fixed-size chunks (legacy).
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
      chunks.push(this.buildChunk(chunks.length, questionSlice));
    }

    return chunks;
  }

  /**
   * Chunk questions adaptively based on estimated token count.
   * Each LLM call receives one chunk; large papers produce many chunks.
   */
  chunkByTokenLimit(
    questions: MatchedQuestion[],
    options: ChunkingOptions = {},
  ): QuestionChunk[] {
    if (questions.length === 0) {
      return [];
    }

    const config = { ...this.defaultOptions, ...options };

    if (options.fixedChunkSize !== undefined) {
      this.logger.log(
        `[chunker] Using fixed chunk size: ${options.fixedChunkSize}`,
      );
      return this.chunk(questions, options.fixedChunkSize);
    }

    const inputBudget = Math.max(
      1000,
      config.maxTokensPerChunk - config.promptOverheadTokens,
    );

    const chunks: QuestionChunk[] = [];
    let currentChunk: MatchedQuestion[] = [];
    let currentTokens = 0;

    const flush = () => {
      if (currentChunk.length === 0) {
        return;
      }

      chunks.push(this.buildChunk(chunks.length, currentChunk));
      currentChunk = [];
      currentTokens = 0;
    };

    for (const question of questions) {
      const questionTokens = this.estimateQuestionTokens(question);

      if (questionTokens > inputBudget && currentChunk.length === 0) {
        this.logger.warn(
          `[chunker] Question ${question.number} alone exceeds input budget (~${questionTokens} tokens); sending as its own chunk`,
        );
        chunks.push(this.buildChunk(chunks.length, [question]));
        continue;
      }

      const wouldExceedTokens = currentTokens + questionTokens > inputBudget;
      const wouldExceedCount =
        currentChunk.length >= config.maxQuestionsPerChunk;

      if (currentChunk.length > 0 && (wouldExceedTokens || wouldExceedCount)) {
        flush();
      }

      currentChunk.push(question);
      currentTokens += questionTokens;
    }

    flush();

    const merged = this.mergeSmallTrailingChunk(chunks, inputBudget, config);

    this.logChunkSummary(merged, questions.length, inputBudget);

    return merged;
  }

  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  estimateQuestionTokens(question: MatchedQuestion): number {
    return this.estimateTokens(question.question + (question.solution ?? ''));
  }

  estimateTotalTokens(questions: MatchedQuestion[]): number {
    return questions.reduce(
      (total, question) => total + this.estimateQuestionTokens(question),
      0,
    );
  }

  getChunkingStats(
    questions: MatchedQuestion[],
    options: ChunkingOptions = {},
  ): {
    totalQuestions: number;
    totalTokens: number;
    estimatedChunks: number;
    avgQuestionsPerChunk: number;
    avgTokensPerChunk: number;
    chunks: Array<{
      chunkIndex: number;
      questionCount: number;
      estimatedTokens: number;
      questionNumbers: number[];
    }>;
  } {
    const totalQuestions = questions.length;
    const totalTokens = this.estimateTotalTokens(questions);
    const chunks = this.chunkByTokenLimit(questions, options);

    return {
      totalQuestions,
      totalTokens,
      estimatedChunks: chunks.length,
      avgQuestionsPerChunk:
        chunks.length > 0 ? Math.round(totalQuestions / chunks.length) : 0,
      avgTokensPerChunk:
        chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0,
      chunks: chunks.map(chunk => ({
        chunkIndex: chunk.chunkIndex,
        questionCount: chunk.questions.length,
        estimatedTokens: chunk.estimatedTokens ?? 0,
        questionNumbers: chunk.questions.map(question => question.number),
      })),
    };
  }

  private buildChunk(
    chunkIndex: number,
    questions: MatchedQuestion[],
  ): QuestionChunk {
    return {
      chunkIndex,
      questions,
      estimatedTokens: this.estimateTotalTokens(questions),
      retryCount: 0,
      status: 'pending',
    };
  }

  /**
   * Merge a tiny final chunk into the previous one when both fit in budget.
   */
  private mergeSmallTrailingChunk(
    chunks: QuestionChunk[],
    inputBudget: number,
    config: Required<Omit<ChunkingOptions, 'fixedChunkSize'>>,
  ): QuestionChunk[] {
    if (chunks.length < 2) {
      return chunks;
    }

    const last = chunks[chunks.length - 1];
    const previous = chunks[chunks.length - 2];

    if (last.questions.length >= config.minQuestionsPerChunk) {
      return chunks;
    }

    const combinedTokens =
      (previous.estimatedTokens ?? 0) + (last.estimatedTokens ?? 0);
    const combinedCount = previous.questions.length + last.questions.length;

    if (
      combinedTokens <= inputBudget &&
      combinedCount <= config.maxQuestionsPerChunk
    ) {
      const merged = [
        ...chunks.slice(0, -2),
        this.buildChunk(previous.chunkIndex, [
          ...previous.questions,
          ...last.questions,
        ]),
      ];

      this.logger.debug(
        `[chunker] Merged trailing chunk (${last.questions.length} questions) into previous chunk`,
      );

      return merged;
    }

    return chunks;
  }

  private logChunkSummary(
    chunks: QuestionChunk[],
    totalQuestions: number,
    inputBudget: number,
  ): void {
    this.logger.log(
      `[chunker] Created ${chunks.length} chunk(s) from ${totalQuestions} question(s) (input budget ~${inputBudget} tokens/chunk)`,
    );

    chunks.forEach(chunk => {
      this.logger.debug(
        `[chunker] Chunk ${chunk.chunkIndex}: ${chunk.questions.length} questions, ~${chunk.estimatedTokens} tokens [${chunk.questions.map(q => q.number).join(', ')}]`,
      );
    });
  }
}
