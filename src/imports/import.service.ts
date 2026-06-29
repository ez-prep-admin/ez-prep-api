import { Injectable, Logger } from '@nestjs/common';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { DocumentParserFactory } from './parser/factories/document-parser.factory';
import { MatchedQuestion } from './types/matched-question';
import { ParserWarning } from './types/parser-result';
import { MarkdownParserService } from './parser/markdown-parser.service';
import { SavedParseResult } from './types/saved-parse-result';
import { DeepseekService } from './llm/deepseek.service';
import { AiOutputValidator } from './validators/ai-output.validator';
import { BusinessValidator } from './validators/business.validator';
import { QuestionMapper } from './mapper/question.mapper';
import { NEET_BUSINESS_VALIDATOR_CONFIG } from './config/business-validator.config';
import {
  EnrichDebugResult,
  EnrichError,
  PersistQuestionsResult,
} from './types/import-question';
import { AiOutputValidationError } from './validators/ai-output.validator';
import { BusinessValidationError } from './validators/business.validator';
import {
  QuestionChunkerService,
  QuestionChunk,
} from './chunking/question-chunker.service';
import { AiQuestionBatchItem } from './types/ai-question-output';
import { ImportQuestion } from './types/import-question';
import { PersistQuestionValidator } from './validators/persist-question.validator';
import { PersistQuestionValidationError } from './validators/persist-question.validator';
import { QuestionPersistenceService } from './persistence/question-persistence.service';

export interface ParseDebugResult {
  parserName: string;
  document: SavedParseResult['document'] & { rawMarkdown?: string };
  matchedQuestions: MatchedQuestion[];
  warnings: ParserWarning[];
  stats: {
    questionCount: number;
    solutionCount: number;
    matchedCount: number;
  };
  savedTo?: string;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  private static readonly TEST_DATA_DIR = join(process.cwd(), 'test/test_data');
  private static readonly FLIP_TEST_MARKDOWN_PATH = join(
    ImportService.TEST_DATA_DIR,
    'Flip test-25.md',
  );
  private static readonly FLIP_TEST_PARSED_JSON_PATH = join(
    ImportService.TEST_DATA_DIR,
    'flip-test-25-parsed.json',
  );

  constructor(
    private readonly documentParserFactory: DocumentParserFactory,
    private readonly markdownParser: MarkdownParserService,
    private readonly deepseekService: DeepseekService,
    private readonly aiOutputValidator: AiOutputValidator,
    private readonly businessValidator: BusinessValidator,
    private readonly questionMapper: QuestionMapper,
    private readonly questionChunker: QuestionChunkerService,
    private readonly persistQuestionValidator: PersistQuestionValidator,
    private readonly questionPersistenceService: QuestionPersistenceService,
  ) {}

  async parseMarkdown(
    markdown: string,
    options?: { saveToDisk?: boolean },
  ): Promise<ParseDebugResult> {
    const parser = this.documentParserFactory.getParser(markdown);
    const document = this.markdownParser.parse(
      markdown,
      parser.configuration.markers,
    );
    const result = await parser.parseWithResult(markdown);

    const response: ParseDebugResult = {
      parserName: parser.configuration.parserName,
      document: {
        questionsSection: document.questionsSection,
        solutionsSection: document.solutionsSection,
      },
      matchedQuestions: result.data,
      warnings: result.warnings,
      stats: {
        questionCount: result.data.length,
        solutionCount: result.data.filter(item => item.solution).length,
        matchedCount: result.data.filter(item => item.solution).length,
      },
    };

    if (options?.saveToDisk) {
      response.savedTo = await this.saveParseResult(response);
    }

    return response;
  }

  async parseFlipTestSample(): Promise<ParseDebugResult> {
    const markdown = await readFile(
      ImportService.FLIP_TEST_MARKDOWN_PATH,
      'utf-8',
    );

    return this.parseMarkdown(markdown, { saveToDisk: true });
  }

  async enrichFlipTestSample(): Promise<EnrichDebugResult> {
    this.logger.log('[enrich] Loading saved parse result from disk');
    const saved = await this.loadSavedParseResult();
    this.logger.log(
      `[enrich] Loaded ${saved.matchedQuestions.length} matched question(s) from ${ImportService.FLIP_TEST_PARSED_JSON_PATH}`,
    );

    return this.enrichMatchedQuestions(saved.matchedQuestions);
  }

  async enrichMatchedQuestions(
    matchedQuestions: MatchedQuestion[],
    options?: {
      useParallel?: boolean;
      maxRetries?: number;
      adaptiveChunking?: boolean;
    },
  ): Promise<EnrichDebugResult> {
    const startedAt = Date.now();
    const useParallel = options?.useParallel ?? false;
    const maxRetries = options?.maxRetries ?? 3;
    const adaptiveChunking = options?.adaptiveChunking ?? false;

    // Use adaptive chunking if enabled, otherwise use legacy chunking
    const chunks = adaptiveChunking
      ? this.questionChunker.chunkByTokenLimit(matchedQuestions, {
          maxTokensPerChunk: 20000,
        })
      : this.questionChunker.chunk(matchedQuestions);

    this.logger.log(
      `[enrich] Starting batch enrichment: ${matchedQuestions.length} question(s) in ${chunks.length} chunk(s) (parallel=${useParallel}, adaptive=${adaptiveChunking})`,
    );

    if (adaptiveChunking) {
      const stats = this.questionChunker.getChunkingStats(matchedQuestions);
      this.logger.log(
        `[enrich] Chunking stats: ~${stats.totalTokens} tokens, avg ${stats.avgQuestionsPerChunk} questions/chunk, avg ${stats.avgTokensPerChunk} tokens/chunk`,
      );
    }

    // Process chunks (parallel or sequential)
    const chunkResults = useParallel
      ? await this.processChunksParallel(chunks, maxRetries)
      : await this.processChunksSequential(chunks, maxRetries);

    // Aggregate results
    const questions: ImportQuestion[] = [];
    const errors: EnrichError[] = [];

    for (const result of chunkResults) {
      questions.push(...result.questions);
      errors.push(...result.errors);
    }

    const summary = {
      total: matchedQuestions.length,
      success: questions.length,
      failed: errors.length,
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `[enrich] Completed in ${summary.durationMs}ms — success=${summary.success}, failed=${summary.failed}`,
    );

    return {
      questions,
      errors,
      stats: {
        total: summary.total,
        success: summary.success,
        failed: summary.failed,
      },
    };
  }

  /**
   * Process chunks sequentially (legacy behavior)
   */
  private async processChunksSequential(
    chunks: QuestionChunk[],
    maxRetries: number,
  ): Promise<Array<{ questions: ImportQuestion[]; errors: EnrichError[] }>> {
    const results: Array<{ questions: ImportQuestion[]; errors: EnrichError[] }> = [];

    for (const chunk of chunks) {
      const result = await this.processChunkWithRetry(chunk, maxRetries);
      results.push(result);
    }

    return results;
  }

  /**
   * Process chunks in parallel with Promise.allSettled
   */
  private async processChunksParallel(
    chunks: QuestionChunk[],
    maxRetries: number,
  ): Promise<Array<{ questions: ImportQuestion[]; errors: EnrichError[] }>> {
    this.logger.log(`[enrich] Processing ${chunks.length} chunk(s) in parallel`);

    const promises = chunks.map(chunk =>
      this.processChunkWithRetry(chunk, maxRetries),
    );

    const settled = await Promise.allSettled(promises);

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle rejected promise (should not happen with proper error handling in processChunkWithRetry)
        this.logger.error(
          `[enrich] Chunk ${index} promise rejected: ${result.reason}`,
        );
        const chunk = chunks[index];
        return {
          questions: [],
          errors: chunk.questions.map(q => ({
            number: q.number,
            stage: 'llm' as const,
            message: `Chunk processing failed: ${result.reason}`,
          })),
        };
      }
    });
  }

  /**
   * Process a single chunk with retry logic and exponential backoff
   */
  private async processChunkWithRetry(
    chunk: QuestionChunk,
    maxRetries: number,
    currentAttempt = 1,
  ): Promise<{ questions: ImportQuestion[]; errors: EnrichError[] }> {
    const chunkStartedAt = Date.now();
    const numbers = chunk.questions
      .map(question => question.number)
      .join(', ');

    this.logger.log(
      `[enrich] Chunk ${chunk.chunkIndex} (attempt ${currentAttempt}/${maxRetries}): sending ${chunk.questions.length} question(s) to DeepSeek [${numbers}]`,
    );

    try {
      const rawJson = await this.deepseekService.extractQuestionsBatch(
        chunk.questions,
      );

      this.logger.log(
        `[enrich] Chunk ${chunk.chunkIndex}: DeepSeek responded in ${Date.now() - chunkStartedAt}ms`,
      );

      return this.processChunkResponse(chunk, rawJson);
    } catch (error) {
      const duration = Date.now() - chunkStartedAt;
      const message =
        error instanceof Error ? error.message : 'Unknown chunk error';

      this.logger.error(
        `[enrich] Chunk ${chunk.chunkIndex} failed after ${duration}ms (attempt ${currentAttempt}/${maxRetries}): ${message}`,
      );

      // Retry with exponential backoff if attempts remaining
      if (currentAttempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, currentAttempt - 1), 10000);
        this.logger.log(
          `[enrich] Chunk ${chunk.chunkIndex}: retrying after ${backoffMs}ms backoff`,
        );
        await this.sleep(backoffMs);
        return this.processChunkWithRetry(chunk, maxRetries, currentAttempt + 1);
      }

      // All retries exhausted, return errors for all questions in chunk
      this.logger.error(
        `[enrich] Chunk ${chunk.chunkIndex}: all ${maxRetries} attempts failed`,
      );

      return {
        questions: [],
        errors: chunk.questions.map(q => ({
          number: q.number,
          stage: 'llm' as const,
          message: `Chunk ${chunk.chunkIndex} failed after ${maxRetries} attempts: ${message}`,
        })),
      };
    }
  }

  /**
   * Process successful chunk response
   */
  private processChunkResponse(
    chunk: QuestionChunk,
    rawJson: string,
  ): { questions: ImportQuestion[]; errors: EnrichError[] } {
    const questions: ImportQuestion[] = [];
    const errors: EnrichError[] = [];

    const batchOutputs = this.aiOutputValidator
      .validateBatch(rawJson)
      .sort((left, right) => left.number - right.number);
    const returnedNumbers = new Set(
      batchOutputs.map(output => output.number),
    );

    // Check for missing questions in LLM response
    for (const matched of chunk.questions) {
      if (!returnedNumbers.has(matched.number)) {
        const message = `Question ${matched.number} missing from batch LLM response.`;
        errors.push({ number: matched.number, stage: 'llm', message });
        this.logger.error(`[enrich] ${message}`);
      }
    }

    const matchedByNumber = new Map(
      chunk.questions.map(question => [question.number, question]),
    );

    // Process each output from LLM
    for (const output of batchOutputs) {
      try {
        const matched = matchedByNumber.get(output.number);

        if (!matched) {
          continue;
        }

        const question = this.processBatchItem(output, matched);
        questions.push(question);
        this.logger.log(
          `[enrich] Question ${output.number} enriched successfully`,
        );
      } catch (error) {
        const enrichError = this.toEnrichError(output.number, error);
        errors.push(enrichError);
        this.logger.error(
          `[enrich] Question ${output.number} failed at stage=${enrichError.stage}: ${enrichError.message}`,
        );
      }
    }

    return { questions, errors };
  }

  /**
   * Sleep utility for exponential backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async persistQuestions(payload: unknown): Promise<PersistQuestionsResult> {
    const startedAt = Date.now();
    const questions =
      this.persistQuestionValidator.validateQuestionsPayload(payload);

    this.logger.log(`[persist] Starting import of ${questions.length} question(s)`);

    const saved: PersistQuestionsResult['saved'] = [];
    const errors: PersistQuestionsResult['errors'] = [];

    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];

      try {
        const validated = await this.persistQuestionValidator.validateQuestion(
          question,
          index,
        );
        const created =
          await this.questionPersistenceService.saveOne(validated);

        saved.push({
          index,
          questionId: created._id.toString(),
        });
        this.logger.log(
          `[persist] Question ${index + 1}/${questions.length} saved as ${created._id.toString()}`,
        );
      } catch (error) {
        const message = this.toPersistErrorMessage(error);
        errors.push({ index, message });
        this.logger.error(`[persist] Question at index ${index} failed: ${message}`);
      }
    }

    const result = {
      saved,
      errors,
      stats: {
        total: questions.length,
        saved: saved.length,
        failed: errors.length,
      },
    };

    this.logger.log(
      `[persist] Completed in ${Date.now() - startedAt}ms — saved=${result.stats.saved}, failed=${result.stats.failed}`,
    );

    return result;
  }

  private toPersistErrorMessage(error: unknown): string {
    if (error instanceof PersistQuestionValidationError) {
      const details = error.details?.join('; ');
      return details ? `${error.message} ${details}` : error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  private processBatchItem(
    output: AiQuestionBatchItem,
    matched: MatchedQuestion,
  ) {
    const { number: _number, ...aiOutput } = output;

    const validated = this.businessValidator.validate(
      aiOutput,
      NEET_BUSINESS_VALIDATOR_CONFIG,
    );

    return this.questionMapper.map(validated, undefined, matched);
  }

  private async saveParseResult(result: ParseDebugResult): Promise<string> {
    const payload: SavedParseResult = {
      parserName: result.parserName,
      document: result.document,
      matchedQuestions: result.matchedQuestions,
      warnings: result.warnings,
      stats: result.stats,
      savedAt: new Date().toISOString(),
    };

    await writeFile(
      ImportService.FLIP_TEST_PARSED_JSON_PATH,
      JSON.stringify(payload, null, 2),
      'utf-8',
    );

    this.logger.log(
      `Saved parsed output to ${ImportService.FLIP_TEST_PARSED_JSON_PATH}`,
    );

    return ImportService.FLIP_TEST_PARSED_JSON_PATH;
  }

  private async loadSavedParseResult(): Promise<SavedParseResult> {
    const raw = await readFile(
      ImportService.FLIP_TEST_PARSED_JSON_PATH,
      'utf-8',
    );
    return JSON.parse(raw) as SavedParseResult;
  }

  private toEnrichError(number: number, error: unknown): EnrichError {
    if (error instanceof AiOutputValidationError) {
      const details = error.details?.join('; ');
      return {
        number,
        stage: 'zod',
        message: details ? `${error.message} ${details}` : error.message,
      };
    }

    if (error instanceof BusinessValidationError) {
      const details = error.details?.join('; ');
      return {
        number,
        stage: 'business',
        message: details ? `${error.message} ${details}` : error.message,
      };
    }

    return {
      number,
      stage: 'llm',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
