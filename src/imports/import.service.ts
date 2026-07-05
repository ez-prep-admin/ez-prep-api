import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentParserFactory } from './parser/factories/document-parser.factory';
import { AdaptiveParserStrategy } from './parser/strategies/adaptive-parser.strategy';
import { MatchedQuestion } from './types/matched-question';
import { ParserWarning, ParserError } from './types/parser-result';
import { DocumentStructure } from './types/document-structure';
import { DeepseekService } from './llm/deepseek.service';
import { DeepseekLlmResult } from './llm/deepseek.types';
import { AiOutputValidator } from './validators/ai-output.validator';
import { BusinessValidator } from './validators/business.validator';
import {
  QuestionMapper,
  QuestionMapperMetadata,
} from './mapper/question.mapper';
import { NEET_BUSINESS_VALIDATOR_CONFIG } from './config/business-validator.config';
import type { DifficultyLevel } from './config/business-validator.config';
import {
  EnrichDebugResult,
  EnrichError,
  PersistQuestionsResult,
  RejectedQuestion,
} from './types/import-question';
import { AiOutputValidationError } from './validators/ai-output.validator';
import { BusinessValidationError } from './validators/business.validator';
import {
  QuestionChunkerService,
  QuestionChunk,
} from './chunking/question-chunker.service';
import { AiQuestionBatchItem } from './types/ai-question-output';
import {
  ImportQuestion,
  PDF_IMPORT_QUESTION_SOURCE,
} from './types/import-question';
import { PersistQuestionValidator } from './validators/persist-question.validator';
import { PersistQuestionValidationError } from './validators/persist-question.validator';
import { QuestionPersistenceService } from './persistence/question-persistence.service';
import { FailedQuestionService } from './persistence/failed-question.service';
import { FailedQuestionDocument } from './schemas/failed-question.schema';
import {
  ImportImageMaterializeError,
  ImportImageStorageService,
} from './images/import-image-storage.service';
import { isPendingImportImage } from './types/import-image-metadata';
import { S3Service } from '../aws/s3/s3.service';
import { MathpixService } from '../integrations/mathpix/mathpix.service';
import {
  QuestionUpload,
  QuestionUploadDocument,
} from './schemas/question-upload.schema';
import {
  UploadQuestionPdfDto,
  UploadQuestionPdfResponseDto,
} from './dto/upload-question-pdf.dto';
import {
  ParseQuestionPdfDto,
  ParseQuestionPdfResponseDto,
  GetUploadDetailsResponseDto,
  UploadsListResponseDto,
  UploadMetadataDto,
} from './dto/parse-question-pdf.dto';
import { ParseMarkdownResponseDto } from './dto/parse-markdown.dto';
import { EnrichQuestionsDto } from './dto/enrich-questions.dto';
import { randomUUID } from 'crypto';
import {
  aggregateChunkEnrichResults,
  ChunkEnrichResult,
  ensureMatchedQuestionIndices,
} from './utils/enrich-result.util';

/** deepseek-chat 64K context — generous input budget, reserve headroom for batch JSON output */
const ENRICH_MAX_TOKENS_PER_CHUNK = 28000;
const ENRICH_PROMPT_OVERHEAD_TOKENS = 8000;
const ENRICH_MAX_QUESTIONS_PER_CHUNK = 20;

export interface StartEnrichUploadResult {
  uploadId: string;
  status: 'processing';
  message: string;
}

export interface ParseMarkdownResult {
  parserName: string;
  matchedQuestions: MatchedQuestion[];
  warnings: ParserWarning[];
  errors: ParserError[];
  stats: {
    questionCount: number;
    solutionCount: number;
    matchedCount: number;
  };
}

@Injectable()
export class ImportService {
  /** In-process guard against duplicate enrich jobs before Mongo status is saved */
  private readonly activeEnrichJobs = new Set<string>();
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly documentParserFactory: DocumentParserFactory,
    private readonly adaptiveParser: AdaptiveParserStrategy,
    private readonly deepseekService: DeepseekService,
    private readonly aiOutputValidator: AiOutputValidator,
    private readonly businessValidator: BusinessValidator,
    private readonly questionMapper: QuestionMapper,
    private readonly questionChunker: QuestionChunkerService,
    private readonly persistQuestionValidator: PersistQuestionValidator,
    private readonly questionPersistenceService: QuestionPersistenceService,
    private readonly failedQuestionService: FailedQuestionService,
    private readonly importImageStorage: ImportImageStorageService,
    private readonly s3Service: S3Service,
    private readonly mathpixService: MathpixService,
    @InjectModel(QuestionUpload.name)
    private readonly questionUploadModel: Model<QuestionUploadDocument>,
  ) {}

  async parseMarkdown(
    markdown: string,
    options?: { cachedStructure?: DocumentStructure | null },
  ): Promise<ParseMarkdownResult> {
    this.adaptiveParser.clearCache();

    if (options?.cachedStructure) {
      this.adaptiveParser.seedStructure(options.cachedStructure);
    }

    const parser = this.documentParserFactory.getParser(markdown);
    const result = await parser.parseWithResult(markdown);

    if (result.errors.length > 0 && result.data.length === 0) {
      throw new BadRequestException({
        message: 'Markdown parsing failed',
        errors: result.errors,
      });
    }

    return {
      parserName: parser.configuration.parserName,
      matchedQuestions: result.data,
      warnings: result.warnings,
      errors: result.errors,
      stats: {
        questionCount: result.data.length,
        solutionCount: result.data.filter(item => item.solution).length,
        matchedCount: result.data.filter(item => item.solution).length,
      },
    };
  }

  private async resolveMatchedQuestionsForUpload(
    uploadId: string,
    forceReparse = false,
  ): Promise<ParseMarkdownResult & { fromCache: boolean }> {
    const upload = await this.findUploadOrThrow(uploadId);

    if (
      !forceReparse &&
      upload.matchedQuestionsCache &&
      upload.matchedQuestionsCache.length > 0
    ) {
      this.logger.log(
        `[parse] Using cached matched questions for upload_id=${uploadId} (${upload.matchedQuestionsCache.length} items, parsed_at=${upload.markdownParsedAt?.toISOString() ?? 'unknown'})`,
      );

      const matchedQuestions = ensureMatchedQuestionIndices(
        upload.matchedQuestionsCache as MatchedQuestion[],
      );

      return {
        parserName: upload.parserName ?? 'adaptive',
        matchedQuestions,
        warnings: [],
        errors: [],
        stats: {
          questionCount: matchedQuestions.length,
          solutionCount: matchedQuestions.filter(item => item.solution).length,
          matchedCount: matchedQuestions.filter(item => item.solution).length,
        },
        fromCache: true,
      };
    }

    const markdown = await this.getMarkdownContent(uploadId);
    const cachedStructure = upload.documentStructureCache as unknown as
      | DocumentStructure
      | undefined;

    const parsed = await this.parseMarkdown(markdown, {
      cachedStructure: forceReparse ? null : cachedStructure,
    });

    await this.saveParseCache(upload, parsed);

    return {
      ...parsed,
      fromCache: false,
    };
  }

  private async saveParseCache(
    upload: QuestionUploadDocument,
    parsed: ParseMarkdownResult,
  ): Promise<void> {
    upload.parserName = parsed.parserName;
    upload.matchedQuestionsCache = parsed.matchedQuestions.map(
      (question, index) => ({
        ...question,
        index,
      }),
    );
    upload.documentStructureCache = this.adaptiveParser.getCachedStructure() as
      | unknown
      | null as Record<string, unknown> | undefined;
    upload.markdownParsedAt = new Date();
    upload.questionCount = parsed.matchedQuestions.length;
    await upload.save();

    this.logger.log(
      `[parse] Cached ${parsed.matchedQuestions.length} matched question(s) on upload_id=${upload._id.toString()}`,
    );
  }

  async parseUploadMarkdown(
    uploadId: string,
  ): Promise<ParseMarkdownResponseDto> {
    const upload = await this.findUploadOrThrow(uploadId);

    if (!upload.markdownS3Key) {
      throw new BadRequestException(
        'Markdown not available. Parse the PDF first using POST /imports/parse-pdf/:uploadId',
      );
    }

    const markdown = await this.getMarkdownContent(uploadId);
    const parsed = await this.parseMarkdown(markdown);
    await this.saveParseCache(upload, parsed);

    const chunkingPreview = this.questionChunker.getChunkingStats(
      parsed.matchedQuestions,
    );

    return {
      uploadId,
      parserName: parsed.parserName,
      matchedQuestions: parsed.matchedQuestions,
      warnings: parsed.warnings,
      errors: parsed.errors,
      stats: parsed.stats,
      chunkingPreview: {
        estimatedChunks: chunkingPreview.estimatedChunks,
        totalTokens: chunkingPreview.totalTokens,
        avgQuestionsPerChunk: chunkingPreview.avgQuestionsPerChunk,
        avgTokensPerChunk: chunkingPreview.avgTokensPerChunk,
        chunks: chunkingPreview.chunks,
      },
    };
  }

  /**
   * Starts enrichment asynchronously. Returns immediately with status `processing`.
   * Poll GET /imports/uploads/:uploadId until status is `enriched` or `failed`.
   */
  async startEnrichUpload(
    uploadId: string,
    dto: EnrichQuestionsDto = {},
  ): Promise<StartEnrichUploadResult> {
    const upload = await this.findUploadOrThrow(uploadId);

    if (upload.status === 'processing' || this.activeEnrichJobs.has(uploadId)) {
      throw new ConflictException('This upload is already being enriched');
    }

    if (!upload.markdownS3Key) {
      throw new BadRequestException(
        'Markdown not available. Parse the PDF first using POST /imports/parse-pdf/:uploadId',
      );
    }

    // Fail fast on missing metadata before accepting the job.
    this.buildMapperMetadataFromUpload(upload);

    upload.status = 'processing';
    upload.errorMessage = undefined;
    await upload.save();

    this.activeEnrichJobs.add(uploadId);
    void this.runEnrichUploadInBackground(uploadId, dto).finally(() => {
      this.activeEnrichJobs.delete(uploadId);
    });

    this.logger.log(
      `[enrich] Accepted background enrichment job for upload_id=${uploadId}`,
    );

    return {
      uploadId,
      status: 'processing',
      message:
        'Enrichment started. Poll GET /imports/uploads/:uploadId until status is enriched or failed.',
    };
  }

  private async runEnrichUploadInBackground(
    uploadId: string,
    dto: EnrichQuestionsDto,
  ): Promise<void> {
    try {
      await this.executeEnrichUpload(uploadId, dto);
    } catch (error) {
      this.logger.error(
        `[enrich] Background enrichment failed for upload_id=${uploadId}: ${
          error instanceof Error ? error.message : error
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      try {
        const upload = await this.findUploadOrThrow(uploadId);
        if (upload.status === 'processing') {
          upload.status = 'failed';
          upload.errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          await upload.save();
        }
      } catch (saveError) {
        this.logger.error(
          `[enrich] Failed to persist failure status for upload_id=${uploadId}`,
          saveError instanceof Error ? saveError.stack : saveError,
        );
      }
    }
  }

  private async executeEnrichUpload(
    uploadId: string,
    dto: EnrichQuestionsDto = {},
  ): Promise<EnrichDebugResult> {
    const upload = await this.findUploadOrThrow(uploadId);

    try {
      const parsed = await this.resolveMatchedQuestionsForUpload(
        uploadId,
        dto.forceReparse ?? false,
      );

      if (parsed.matchedQuestions.length === 0) {
        throw new BadRequestException(
          'No questions could be parsed from the markdown. The document structure or question boundary pattern may be incorrect — re-parse the PDF or inspect the cached structure.',
        );
      }

      const mapperMetadata = this.buildMapperMetadataFromUpload(upload);

      const result = await this.enrichMatchedQuestions(
        parsed.matchedQuestions,
        {
          adaptiveChunking: dto.adaptiveChunking ?? true,
          useParallel: dto.useParallel ?? false,
          maxRetries: dto.maxRetries ?? 3,
          maxConcurrentChunks: dto.maxConcurrentChunks ?? 2,
          mapperMetadata,
          uploadId,
        },
      );

      if (result.questions.length === 0) {
        const firstError = result.rejected[0]?.message;
        throw new BadRequestException(
          firstError
            ? `Enrichment failed for all questions. First error: ${firstError}`
            : 'Enrichment produced no questions.',
        );
      }

      await this.failedQuestionService.replaceForUpload(
        uploadId,
        result.rejected,
      );

      if (result.rejected.length > 0) {
        this.logger.log(
          `[enrich] Final rejection pass complete for upload_id=${uploadId} — ${result.rejected.length} question(s) written to failed_questions after all chunk retries finished`,
        );
      }

      upload.enrichedQuestions = result.questions as unknown as Record<
        string,
        unknown
      >[];
      upload.enrichmentStats = {
        total: result.stats.total,
        success: result.stats.success,
        failed: result.stats.failed,
        durationMs: result.stats.durationMs ?? 0,
      };
      upload.enrichedAt = new Date();
      upload.questionCount = result.questions.length;
      upload.status = 'enriched';
      upload.errorMessage = undefined;
      await upload.save();

      this.logger.log(
        `[enrich] Background enrichment completed for upload_id=${uploadId} — success=${result.stats.success}, failed=${result.stats.failed}`,
      );

      return {
        ...result,
        uploadId,
        status: 'enriched',
        parse: {
          fromCache: parsed.fromCache,
          parserName: parsed.parserName,
          matchedCount: parsed.stats.matchedCount,
        },
      };
    } catch (error) {
      upload.status = 'failed';
      upload.errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await upload.save();
      throw error;
    }
  }

  async enrichQuestions(dto: EnrichQuestionsDto): Promise<EnrichDebugResult> {
    if (!dto.matchedQuestions?.length) {
      throw new BadRequestException(
        'matchedQuestions is required. Run POST /imports/parse-markdown/:uploadId first, or use POST /imports/enrich/:uploadId.',
      );
    }

    return this.enrichMatchedQuestions(
      ensureMatchedQuestionIndices(dto.matchedQuestions),
      {
      adaptiveChunking: dto.adaptiveChunking ?? true,
      useParallel: dto.useParallel ?? false,
      maxRetries: dto.maxRetries ?? 3,
      maxConcurrentChunks: dto.maxConcurrentChunks ?? 2,
      mapperMetadata: this.buildMapperMetadataFromDto(dto),
    });
  }

  private buildMapperMetadataFromUpload(
    upload: QuestionUploadDocument,
  ): QuestionMapperMetadata {
    if (!upload.subject || !upload.topic) {
      throw new BadRequestException(
        'Upload is missing subjectId or topicId. Provide them on upload-pdf before enriching.',
      );
    }

    return {
      subjectId: upload.subject.toString(),
      topicId: upload.topic.toString(),
      examIds: upload.exams?.map(id => id.toString()) ?? [],
    };
  }

  private buildMapperMetadataFromDto(
    dto: EnrichQuestionsDto,
  ): QuestionMapperMetadata {
    if (!dto.subjectId || !dto.topicId) {
      throw new BadRequestException(
        'subjectId and topicId are required when using POST /imports/enrich.',
      );
    }

    return {
      subjectId: dto.subjectId,
      topicId: dto.topicId,
      examIds: dto.examIds ?? [],
    };
  }

  async enrichMatchedQuestions(
    matchedQuestions: MatchedQuestion[],
    options: {
      useParallel?: boolean;
      maxRetries?: number;
      adaptiveChunking?: boolean;
      maxConcurrentChunks?: number;
      mapperMetadata: QuestionMapperMetadata;
      uploadId?: string;
    },
  ): Promise<EnrichDebugResult> {
    const startedAt = Date.now();
    const useParallel = options?.useParallel ?? false;
    const maxRetries = options?.maxRetries ?? 3;
    const adaptiveChunking = options?.adaptiveChunking ?? true;
    const maxConcurrentChunks = options?.maxConcurrentChunks ?? 2;
    const indexedQuestions = ensureMatchedQuestionIndices(matchedQuestions);

    this.importImageStorage.clearSessionCache();

    const chunkingOptions = {
      maxTokensPerChunk: ENRICH_MAX_TOKENS_PER_CHUNK,
      promptOverheadTokens: ENRICH_PROMPT_OVERHEAD_TOKENS,
      maxQuestionsPerChunk: ENRICH_MAX_QUESTIONS_PER_CHUNK,
    };

    const chunks = adaptiveChunking
      ? this.questionChunker.chunkByTokenLimit(
          indexedQuestions,
          chunkingOptions,
        )
      : this.questionChunker.chunk(indexedQuestions);

    const chunkingStats = {
      totalTokens: this.questionChunker.estimateTotalTokens(indexedQuestions),
      chunks: chunks.map(chunk => ({
        chunkIndex: chunk.chunkIndex,
        questionCount: chunk.questions.length,
        estimatedTokens: chunk.estimatedTokens ?? 0,
        questionNumbers: chunk.questions.map(question => question.number),
      })),
    };

    this.logger.log(
      `[enrich] Starting batch enrichment: ${indexedQuestions.length} question(s) in ${chunks.length} chunk(s) (parallel=${useParallel}, adaptive=${adaptiveChunking}, maxQuestionsPerChunk=${ENRICH_MAX_QUESTIONS_PER_CHUNK})`,
    );

    this.logger.log(
      `[enrich] Chunking stats: ~${chunkingStats.totalTokens} tokens across ${chunks.length} chunk(s)`,
    );

    const chunkResults = useParallel
      ? await this.processChunksParallel(
          chunks,
          maxRetries,
          maxConcurrentChunks,
          options.mapperMetadata,
          options.uploadId,
        )
      : await this.processChunksSequential(
          chunks,
          maxRetries,
          options.mapperMetadata,
          options.uploadId,
        );

    const { questions, errors } = aggregateChunkEnrichResults(chunkResults);

    errors.sort((left, right) => (left.index ?? left.number) - (right.index ?? right.number));

    const matchedByIndex = new Map(
      indexedQuestions.map(question => [question.index!, question]),
    );

    const rejected: RejectedQuestion[] = errors.map(error =>
      this.toRejectedQuestion(error, matchedByIndex),
    );

    const summary = {
      total: indexedQuestions.length,
      success: questions.length,
      failed: rejected.length,
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `[enrich] Completed in ${summary.durationMs}ms — success=${summary.success}, failed=${summary.failed}`,
    );

    return {
      questions,
      rejected,
      stats: summary,
      summary: this.buildEnrichSummaryMessage(summary),
      chunking: {
        adaptiveChunking,
        chunkCount: chunks.length,
        totalTokens: chunkingStats.totalTokens,
        chunks: chunkingStats.chunks,
      },
    };
  }

  /**
   * Process chunks sequentially (legacy behavior)
   */
  private async processChunksSequential(
    chunks: QuestionChunk[],
    maxRetries: number,
    mapperMetadata: QuestionMapperMetadata,
    uploadId?: string,
  ): Promise<ChunkEnrichResult[]> {
    const results: ChunkEnrichResult[] = [];

    for (const chunk of chunks) {
      const result = await this.processChunkWithRetry(
        chunk,
        maxRetries,
        mapperMetadata,
        uploadId,
      );
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
    maxConcurrentChunks: number,
    mapperMetadata: QuestionMapperMetadata,
    uploadId?: string,
  ): Promise<ChunkEnrichResult[]> {
    this.logger.log(
      `[enrich] Processing ${chunks.length} chunk(s) in parallel (concurrency=${maxConcurrentChunks})`,
    );

    const results: ChunkEnrichResult[] = [];

    for (let index = 0; index < chunks.length; index += maxConcurrentChunks) {
      const batch = chunks.slice(index, index + maxConcurrentChunks);
      const settled = await Promise.allSettled(
        batch.map(chunk =>
          this.processChunkWithRetry(
            chunk,
            maxRetries,
            mapperMetadata,
            uploadId,
          ),
        ),
      );

      settled.forEach((result, batchIndex) => {
        const chunk = batch[batchIndex];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          return;
        }

        this.logger.error(
          `[enrich] Chunk ${chunk.chunkIndex} promise rejected: ${result.reason}`,
        );

        results.push({
          questions: [],
          enrichedIndices: [],
          errors: chunk.questions.map(q => ({
            index: q.index!,
            number: q.number,
            matchedQuestion: q,
            stage: 'llm' as const,
            message: `Chunk processing failed: ${result.reason}`,
            questionDraft: this.buildMetadataQuestionShell(mapperMetadata, {
              questionMarkdown: q.question,
              solutionMarkdown: q.solution,
            }),
          })),
        });
      });
    }

    return results;
  }

  /**
   * Process a single chunk with retry logic and exponential backoff
   */
  private async processChunkWithRetry(
    chunk: QuestionChunk,
    maxRetries: number,
    mapperMetadata: QuestionMapperMetadata,
    uploadId?: string,
    currentAttempt = 1,
  ): Promise<ChunkEnrichResult> {
    const chunkStartedAt = Date.now();
    const numbers = chunk.questions.map(question => question.number).join(', ');

    this.logger.log(
      `[enrich] Chunk ${chunk.chunkIndex} (attempt ${currentAttempt}/${maxRetries}): sending ${chunk.questions.length} question(s) to DeepSeek [${numbers}]`,
    );

    try {
      const llmResult = await this.deepseekService.extractQuestionsBatch(
        chunk.questions,
      );

      this.logger.log(
        `[enrich] Chunk ${chunk.chunkIndex}: DeepSeek responded in ${Date.now() - chunkStartedAt}ms (finish_reason=${llmResult.finishReason ?? 'n/a'})`,
      );

      if (llmResult.finishReason === 'length') {
        throw new AiOutputValidationError(
          'Model batch response was truncated before valid JSON could be produced.',
        );
      }

      return await this.processChunkResponse(
        chunk,
        llmResult,
        mapperMetadata,
        uploadId,
      );
    } catch (error) {
      const duration = Date.now() - chunkStartedAt;
      const message =
        error instanceof Error ? error.message : 'Unknown chunk error';

      this.logger.error(
        `[enrich] Chunk ${chunk.chunkIndex} failed after ${duration}ms (attempt ${currentAttempt}/${maxRetries}): ${message}`,
      );

      // Retry with exponential backoff if attempts remaining
      if (currentAttempt < maxRetries) {
        const backoffMs = Math.min(
          1000 * Math.pow(2, currentAttempt - 1),
          10000,
        );
        this.logger.log(
          `[enrich] Chunk ${chunk.chunkIndex}: retrying after ${backoffMs}ms backoff`,
        );
        await this.sleep(backoffMs);
        return this.processChunkWithRetry(
          chunk,
          maxRetries,
          mapperMetadata,
          uploadId,
          currentAttempt + 1,
        );
      }

      // All retries exhausted, return errors for all questions in chunk
      this.logger.error(
        `[enrich] Chunk ${chunk.chunkIndex}: all ${maxRetries} attempts failed`,
      );

      return {
        questions: [],
        enrichedIndices: [],
        errors: chunk.questions.map(q => ({
          index: q.index!,
          number: q.number,
          matchedQuestion: q,
          stage: 'llm' as const,
          message: `Chunk ${chunk.chunkIndex} failed after ${maxRetries} attempts: ${message}`,
          questionDraft: this.buildMetadataQuestionShell(mapperMetadata, {
            questionMarkdown: q.question,
            solutionMarkdown: q.solution,
          }),
        })),
      };
    }
  }

  /**
   * Process successful chunk response
   */
  private async processChunkResponse(
    chunk: QuestionChunk,
    llmResult: DeepseekLlmResult,
    mapperMetadata: QuestionMapperMetadata,
    uploadId?: string,
  ): Promise<ChunkEnrichResult> {
    const questions: ImportQuestion[] = [];
    const errors: EnrichError[] = [];
    const enrichedIndices: number[] = [];

    const batchOutputs = this.aiOutputValidator
      .validateBatch(llmResult.content, {
        chunkIndex: chunk.chunkIndex,
        questionNumbers: chunk.questions.map(question => question.number),
        finishReason: llmResult.finishReason,
        completionTokens: llmResult.completionTokens,
        responseChars: llmResult.content.length,
      })
      .sort((left, right) => left.number - right.number);
    const returnedNumbers = new Set(batchOutputs.map(output => output.number));

    // Check for missing questions in LLM response
    for (const matched of chunk.questions) {
      if (!returnedNumbers.has(matched.number)) {
        const message = `Question ${matched.number} missing from batch LLM response.`;
        errors.push({
          index: matched.index!,
          number: matched.number,
          matchedQuestion: matched,
          stage: 'llm',
          message,
          questionDraft: this.buildMetadataQuestionShell(mapperMetadata, {
            questionMarkdown: matched.question,
            solutionMarkdown: matched.solution,
          }),
        });
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

        const question = await this.processBatchItem(
          output,
          matched,
          mapperMetadata,
          uploadId,
        );
        questions.push(question);
        enrichedIndices.push(matched.index!);
        this.logger.log(
          `[enrich] Question ${output.number} enriched successfully`,
        );
      } catch (error) {
        const enrichError = this.toEnrichError(output.number, error);
        const matched = matchedByNumber.get(output.number);

        errors.push({
          ...enrichError,
          index: matched?.index,
          matchedQuestion: matched,
          questionDraft:
            matched &&
            this.buildQuestionDraftOnFailure(
              output,
              matched,
              mapperMetadata,
              error,
            ),
        });
        this.logger.error(
          `[enrich] Question ${output.number} failed at stage=${enrichError.stage}: ${enrichError.message}`,
        );
      }
    }

    return { questions, errors, enrichedIndices };
  }

  /**
   * Sleep utility for exponential backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async persistQuestions(uploadId: string): Promise<
    PersistQuestionsResult & {
      uploadId: string;
      uploadStatus?: string;
      summary: string;
    }
  > {
    const startedAt = Date.now();

    const upload = await this.findUploadOrThrow(uploadId);

    if (!upload.enrichedQuestions?.length) {
      throw new BadRequestException(
        'No enriched questions cached for this upload. Run POST /imports/enrich/:uploadId first.',
      );
    }

    if (upload.status !== 'enriched') {
      throw new BadRequestException(
        `Upload must be in enriched status to persist (current: ${upload.status}).`,
      );
    }

    const questions = upload.enrichedQuestions as unknown as ImportQuestion[];

    this.logger.log(
      `[persist] Loading ${questions.length} cached question(s) for upload_id=${uploadId}`,
    );

    this.logger.log(
      `[persist] Starting import of ${questions.length} question(s)`,
    );

    const saved: PersistQuestionsResult['saved'] = [];
    const errors: PersistQuestionsResult['errors'] = [];

    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];

      try {
        const withImages = this.questionHasPendingImages(question)
          ? await this.importImageStorage.materializeQuestionImages(question, {
              uploadId,
              questionNumber: index + 1,
            })
          : question;

        const validated = await this.persistQuestionValidator.validateQuestion(
          withImages,
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
        this.logger.error(
          `[persist] Question at index ${index} failed: ${message}`,
        );
      }
    }

    let uploadStatus: string | undefined;

    if (errors.length === 0) {
      await this.finalizeCompletedUpload(uploadId, saved.length);
      uploadStatus = 'completed';
    } else {
      const savedIndices = new Set(saved.map(item => item.index));
      upload.enrichedQuestions = questions
        .filter((_, index) => !savedIndices.has(index))
        .map(question => question as unknown as Record<string, unknown>);
      await upload.save();
      uploadStatus = 'enriched';
    }

    const stats = {
      total: questions.length,
      saved: saved.length,
      failed: errors.length,
    };

    const result = {
      saved,
      errors,
      stats,
      uploadId,
      uploadStatus,
      summary: this.buildPersistSummaryMessage(stats),
    };

    this.logger.log(
      `[persist] Completed in ${Date.now() - startedAt}ms — saved=${result.stats.saved}, failed=${result.stats.failed}`,
    );

    return result;
  }

  /**
   * Marks an upload completed and strips heavy caches/metadata via $unset.
   * Setting Mongoose Object fields to undefined does not reliably remove them,
   * so we issue an explicit $unset to keep the document lean once questions are
   * safely in the questions collection. The doc is retained only for tracking.
   */
  private async finalizeCompletedUpload(
    uploadId: string,
    savedCount: number,
  ): Promise<void> {
    await this.questionUploadModel.updateOne(
      { _id: new Types.ObjectId(uploadId) },
      {
        $set: { status: 'completed', questionCount: savedCount },
        $unset: {
          enrichedQuestions: '',
          matchedQuestionsCache: '',
          documentStructureCache: '',
          enrichmentStats: '',
        },
      },
    );

    this.logger.log(
      `[persist] Upload ${uploadId} marked completed; cleared cached questions and parse caches`,
    );
  }

  async getCachedEnrichment(uploadId: string) {
    const upload = await this.findUploadOrThrow(uploadId);

    if (!upload.enrichedAt && !upload.enrichedQuestions?.length) {
      throw new NotFoundException(
        'No enrichment result cached for this upload. Run POST /imports/enrich/:uploadId first.',
      );
    }

    const rejected = await this.failedQuestionService.listByUpload(uploadId);
    const mapperMetadata = this.buildMapperMetadataFromUpload(upload);

    return {
      uploadId,
      status: upload.status,
      questions: upload.enrichedQuestions ?? [],
      rejected: rejected.map(doc =>
        this.toFailedQuestionListItem(doc, mapperMetadata),
      ),
      stats: upload.enrichmentStats ?? {
        total: 0,
        success: 0,
        failed: rejected.length,
        durationMs: 0,
      },
      enrichedAt: upload.enrichedAt,
    };
  }

  async listFailedQuestions(page = 1, limit = 10) {
    const { docs, total } = await this.failedQuestionService.listPaginated(
      page,
      limit,
    );
    const metadataByUploadId = await this.loadMapperMetadataByUploadIds(docs);

    const items = docs.map(doc => {
      const mapperMetadata = metadataByUploadId.get(doc.uploadId.toString());
      return this.toFailedQuestionListItem(
        doc,
        mapperMetadata ?? {
          subjectId: '',
          topicId: '',
          examIds: [],
        },
      );
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getFailedQuestion(failedQuestionId: string) {
    const doc =
      await this.failedQuestionService.findByIdOrThrow(failedQuestionId);
    const upload = await this.findUploadOrThrow(doc.uploadId.toString());
    const mapperMetadata = this.buildMapperMetadataFromUpload(upload);

    return this.toFailedQuestionListItem(doc, mapperMetadata);
  }

  async importFailedQuestion(
    failedQuestionId: string,
    questionPayload: unknown,
  ): Promise<{ questionId: string; failedQuestionId: string }> {
    const failed =
      await this.failedQuestionService.findByIdOrThrow(failedQuestionId);

    try {
      const withImages =
        questionPayload &&
        typeof questionPayload === 'object' &&
        this.questionHasPendingImages(questionPayload as ImportQuestion)
          ? await this.importImageStorage.materializeQuestionImages(
              questionPayload as ImportQuestion,
              {
                uploadId: failed.uploadId.toString(),
                questionNumber: failed.questionNumber,
              },
            )
          : (questionPayload as ImportQuestion);

      const validated = await this.persistQuestionValidator.validateQuestion(
        withImages,
        0,
      );
      const created = await this.questionPersistenceService.saveOne(validated);
      await this.failedQuestionService.deleteById(failedQuestionId);

      this.logger.log(
        `[failed-questions] Imported fixed question ${created._id.toString()} and removed failed_question_id=${failedQuestionId}`,
      );

      return {
        questionId: created._id.toString(),
        failedQuestionId,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof PersistQuestionValidationError) {
        throw new BadRequestException({
          message: error.message,
          details: error.details,
        });
      }

      throw new BadRequestException(this.toPersistErrorMessage(error));
    }
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

  private async processBatchItem(
    output: AiQuestionBatchItem,
    matched: MatchedQuestion,
    mapperMetadata: QuestionMapperMetadata,
    uploadId?: string,
  ): Promise<ImportQuestion> {
    const mapped = this.mapBatchItemToImportQuestion(
      output,
      matched,
      mapperMetadata,
    );

    return this.importImageStorage.materializeQuestionImages(mapped, {
      uploadId,
      questionNumber: matched.number,
    });
  }

  private mapBatchItemToImportQuestion(
    output: AiQuestionBatchItem,
    matched: MatchedQuestion,
    mapperMetadata: QuestionMapperMetadata,
    skipBusinessValidation = false,
  ): ImportQuestion {
    const { number: _ignoredQuestionNumber, ...aiOutput } = output;
    void _ignoredQuestionNumber;

    const validated = skipBusinessValidation
      ? aiOutput
      : this.businessValidator.validate(
          aiOutput,
          NEET_BUSINESS_VALIDATOR_CONFIG,
        );

    return this.questionMapper.map(validated, mapperMetadata, matched);
  }

  private buildQuestionDraftOnFailure(
    output: AiQuestionBatchItem,
    matched: MatchedQuestion,
    mapperMetadata: QuestionMapperMetadata,
    error: unknown,
  ): ImportQuestion {
    if (error instanceof ImportImageMaterializeError) {
      try {
        return this.mapBatchItemToImportQuestion(
          output,
          matched,
          mapperMetadata,
        );
      } catch {
        // Fall through to best-effort draft below.
      }
    }

    try {
      return this.mapBatchItemToImportQuestion(
        output,
        matched,
        mapperMetadata,
        true,
      );
    } catch {
      return this.buildMetadataQuestionShell(mapperMetadata, {
        questionMarkdown: matched.question,
        solutionMarkdown: matched.solution,
        difficultyLevel: output.difficultyLevel,
      });
    }
  }

  private buildMetadataQuestionShell(
    metadata: QuestionMapperMetadata,
    options?: {
      questionMarkdown?: string;
      solutionMarkdown?: string;
      difficultyLevel?: DifficultyLevel;
    },
  ): ImportQuestion {
    const optionIds = Array.from(
      { length: NEET_BUSINESS_VALIDATOR_CONFIG.optionCount },
      () => randomUUID(),
    );

    return {
      questionText: {
        en: {
          text: options?.questionMarkdown ?? '',
          image: null,
        },
        ml: { text: null, image: null },
      },
      optionType: 'text',
      options: optionIds.map(id => ({
        id,
        type: 'text' as const,
        en: '',
        ml: null,
      })),
      explanation: {
        en: options?.solutionMarkdown ?? '',
        ml: null,
        image: null,
      },
      correctAnswer: optionIds[0],
      subject: metadata.subjectId,
      topic: metadata.topicId,
      exams: [...metadata.examIds],
      difficultyLevel: options?.difficultyLevel ?? 'medium',
      isActive: true,
      isDeleted: false,
      source: PDF_IMPORT_QUESTION_SOURCE,
    };
  }

  private async loadMapperMetadataByUploadIds(
    docs: FailedQuestionDocument[],
  ): Promise<Map<string, QuestionMapperMetadata>> {
    const uploadIds = [...new Set(docs.map(doc => doc.uploadId.toString()))];

    if (uploadIds.length === 0) {
      return new Map();
    }

    const uploads = await this.questionUploadModel.find({
      _id: { $in: uploadIds.map(id => new Types.ObjectId(id)) },
    });

    const metadataByUploadId = new Map<string, QuestionMapperMetadata>();

    for (const upload of uploads) {
      if (!upload.subject || !upload.topic) {
        continue;
      }

      metadataByUploadId.set(
        upload._id.toString(),
        this.buildMapperMetadataFromUpload(upload),
      );
    }

    return metadataByUploadId;
  }

  private resolveFailedQuestionEditPayload(
    doc: FailedQuestionDocument,
    mapperMetadata: QuestionMapperMetadata,
  ): ImportQuestion {
    if (doc.questionDraft && typeof doc.questionDraft === 'object') {
      return doc.questionDraft as unknown as ImportQuestion;
    }

    return this.buildMetadataQuestionShell(mapperMetadata, {
      questionMarkdown: doc.matchedQuestion.question,
      solutionMarkdown: doc.matchedQuestion.solution,
    });
  }

  private questionHasPendingImages(question: ImportQuestion): boolean {
    if (
      question.questionText.en.image &&
      isPendingImportImage(question.questionText.en.image)
    ) {
      return true;
    }

    if (
      question.explanation.image &&
      isPendingImportImage(question.explanation.image)
    ) {
      return true;
    }

    return question.options.some(
      option => option.image && isPendingImportImage(option.image),
    );
  }

  private async findUploadOrThrow(
    uploadId: string,
  ): Promise<QuestionUploadDocument> {
    if (!Types.ObjectId.isValid(uploadId)) {
      throw new BadRequestException(`Invalid upload ID: ${uploadId}`);
    }

    const upload = await this.questionUploadModel.findById(
      new Types.ObjectId(uploadId),
    );

    if (!upload) {
      throw new NotFoundException(`Upload not found with ID: ${uploadId}`);
    }

    return upload;
  }

  private buildEnrichSummaryMessage(stats: {
    total: number;
    success: number;
    failed: number;
  }): string {
    if (stats.failed === 0) {
      return `Enrichment complete: all ${stats.success} question(s) passed validation and are ready to import.`;
    }

    if (stats.success === 0) {
      return `Enrichment failed: all ${stats.failed} of ${stats.total} question(s) were rejected. Review failed questions and fix them separately.`;
    }

    return `Enrichment complete: ${stats.success} of ${stats.total} question(s) passed and are ready to import. ${stats.failed} failed — review and fix them separately before importing.`;
  }

  private buildPersistSummaryMessage(stats: {
    total: number;
    saved: number;
    failed: number;
  }): string {
    if (stats.failed === 0) {
      return `Import complete: ${stats.saved} question(s) saved to the database. Upload marked as completed.`;
    }

    if (stats.saved === 0) {
      return `Import failed: none of the ${stats.total} question(s) could be saved. Fix the errors and retry.`;
    }

    return `Import partially complete: ${stats.saved} of ${stats.total} question(s) saved, ${stats.failed} failed. Upload remains enriched — retry to import the remaining questions.`;
  }

  private toRejectedQuestion(
    error: EnrichError,
    matchedByIndex: Map<number, MatchedQuestion>,
  ): RejectedQuestion {
    const matched =
      error.matchedQuestion ??
      (error.index !== undefined
        ? matchedByIndex.get(error.index)
        : undefined);

    return {
      ...error,
      matchedQuestion: matched ?? {
        index: error.index,
        number: error.number,
        question: '',
      },
    };
  }

  private toFailedQuestionListItem(
    doc: FailedQuestionDocument,
    mapperMetadata: QuestionMapperMetadata,
  ) {
    const item = doc.toObject();
    const question = this.resolveFailedQuestionEditPayload(doc, mapperMetadata);

    return {
      id: item.id,
      uploadId: doc.uploadId.toString(),
      questionNumber: doc.questionNumber,
      failureStage: doc.failureStage,
      failureMessage: doc.failureMessage,
      matchedQuestion: doc.matchedQuestion,
      questionDraft: doc.questionDraft as unknown as ImportQuestion | undefined,
      question,
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: doc.updatedAt ?? new Date(),
    };
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

    if (error instanceof ImportImageMaterializeError) {
      return {
        number,
        stage: 'image',
        message: error.message,
      };
    }

    return {
      number,
      stage: 'llm',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  /**
   * Upload a question paper PDF to S3 and track it in database
   * @param file Uploaded PDF file (from Multer)
   * @param dto Upload metadata
   * @param userId User ID (from auth context)
   * @returns Upload response with S3 details
   */
  async uploadQuestionPdf(
    file: Express.Multer.File,
    dto: UploadQuestionPdfDto,
    userId?: string,
  ): Promise<UploadQuestionPdfResponseDto> {
    const startedAt = Date.now();

    this.logger.log(
      `[upload-pdf] Starting upload: ${file.originalname} (${file.size} bytes)`,
    );

    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty or unreadable');
    }

    try {
      // Generate title if not provided
      const title = dto.title?.trim() || randomUUID();

      // Pre-assign upload id so every S3 object gets a unique path, even for duplicate filenames
      const uploadObjectId = new Types.ObjectId();
      const s3Key = this.s3Service.generateQuestionUploadKey(
        uploadObjectId.toString(),
        file.originalname,
      );

      // Upload to S3
      const uploadResult = await this.s3Service.uploadFile(file.buffer, {
        key: s3Key,
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          title: title,
          uploadedBy: userId ?? 'anonymous',
          ...dto.metadata,
        },
      });

      this.logger.log(
        `[upload-pdf] S3 upload successful: ${uploadResult.key} (etag=${uploadResult.etag})`,
      );

      // Create database record
      const upload = new this.questionUploadModel({
        _id: uploadObjectId,
        title: title,
        filename: file.originalname,
        s3Key: uploadResult.key,
        s3Bucket: uploadResult.bucket,
        s3Region: uploadResult.region,
        fileSize: uploadResult.size,
        contentType: uploadResult.contentType,
        status: 'uploaded',
        subject: dto.subjectId ? new Types.ObjectId(dto.subjectId) : undefined,
        topic: dto.topicId ? new Types.ObjectId(dto.topicId) : undefined,
        exams: dto.examIds?.map(id => new Types.ObjectId(id)) ?? [],
        metadata: dto.metadata
          ? new Map(Object.entries(dto.metadata))
          : undefined,
        uploadedBy: userId ? new Types.ObjectId(userId) : undefined,
        source: 'PDF_UPLOAD',
      });

      await upload.save();

      const response: UploadQuestionPdfResponseDto = {
        uploadId: upload._id.toString(),
        title: upload.title,
        filename: upload.filename,
        s3Key: upload.s3Key,
        s3Bucket: upload.s3Bucket,
        fileSize: upload.fileSize,
        status: upload.status,
        uploadedAt: upload.createdAt ?? new Date(),
      };

      this.logger.log(
        `[upload-pdf] Upload completed in ${Date.now() - startedAt}ms (upload_id=${response.uploadId}, title="${title}")`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `[upload-pdf] Upload failed after ${Date.now() - startedAt}ms`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Parse a question paper PDF using Mathpix API
   * @param uploadId Upload ID from database
   * @param dto Parse options
   * @returns Parse response with markdown content
   */
  async parseQuestionPdf(
    uploadId: string,
    dto: ParseQuestionPdfDto = {},
  ): Promise<ParseQuestionPdfResponseDto> {
    const startedAt = Date.now();

    this.logger.log(`[parse-pdf] Starting parse for upload_id=${uploadId}`);

    if (!Types.ObjectId.isValid(uploadId)) {
      throw new BadRequestException(`Invalid upload ID: ${uploadId}`);
    }

    // Find upload record
    const upload = await this.questionUploadModel.findById(
      new Types.ObjectId(uploadId),
    );

    if (!upload) {
      throw new NotFoundException(`Upload not found with ID: ${uploadId}`);
    }

    if (upload.status === 'parsing') {
      throw new ConflictException('This PDF is already being parsed');
    }

    if (upload.status === 'parsed') {
      throw new ConflictException(
        'This PDF has already been parsed. Upload a new file to parse again.',
      );
    }

    try {
      // Update status to parsing
      upload.status = 'parsing';
      upload.parsingStartedAt = new Date();
      upload.errorMessage = undefined;
      await upload.save();

      this.logger.log(
        `[parse-pdf] Generating presigned URL for S3 object: ${upload.s3Key} (bucket=${upload.s3Bucket})`,
      );

      const presigned = await this.s3Service.getPresignedUrl(
        upload.s3Key,
        upload.s3Bucket,
        {
          expiresIn: 3600,
          responseContentType: 'application/pdf',
        },
      );

      this.logger.log(
        `[parse-pdf] Presigned URL created (expires at ${presigned.expiresAt.toISOString()})`,
      );

      // Convert using Mathpix
      const conversionResult = await this.mathpixService.convertPdfToMarkdown(
        presigned.url,
        {
          includeImages: true,
          includeLatex: true,
          includeSmiles: true,
          includeChemistryAsImage: false,
          preferMmdOutput: true,
          ocrLanguage: 'en',
        },
        {
          maxAttempts: dto.maxPollingAttempts ?? 60,
          intervalMs: dto.pollingIntervalMs ?? 5000,
        },
      );

      this.logger.log(
        `[parse-pdf] Mathpix conversion completed: pdf_id=${conversionResult.pdfId}, time=${conversionResult.processingTimeMs}ms`,
      );

      // Save markdown to S3
      const markdownKey = this.s3Service.generateQuestionMarkdownKey(
        upload._id.toString(),
        upload.filename.replace(/\.pdf$/i, '.md'),
      );
      const markdownBuffer = Buffer.from(conversionResult.markdown, 'utf-8');

      const markdownUploadResult = await this.s3Service.uploadFile(
        markdownBuffer,
        {
          key: markdownKey,
          contentType: 'text/markdown',
          metadata: {
            originalPdfKey: upload.s3Key,
            mathpixPdfId: conversionResult.pdfId,
            title: upload.title,
            uploadId: upload._id.toString(),
          },
          tags: {
            type: 'markdown',
            source: 'mathpix',
            pdfUploadId: upload._id.toString(),
          },
        },
      );

      this.logger.log(
        `[parse-pdf] Markdown saved to S3: ${markdownUploadResult.key}`,
      );

      // Update upload record with results (markdown stored ONLY in S3)
      upload.status = 'parsed';
      upload.markdownS3Key = markdownUploadResult.key;
      upload.mathpixPdfId = conversionResult.pdfId;
      upload.parsingCompletedAt = new Date();
      await upload.save();

      const response: ParseQuestionPdfResponseDto = {
        uploadId: upload._id.toString(),
        mathpixPdfId: conversionResult.pdfId,
        markdown: conversionResult.markdown,
        markdownS3Key: markdownUploadResult.key,
        processingTimeMs: Date.now() - startedAt,
        status: 'parsed',
        markdownLength: conversionResult.markdown.length,
      };

      this.logger.log(
        `[parse-pdf] Parse completed in ${response.processingTimeMs}ms (upload_id=${uploadId})`,
      );

      return response;
    } catch (error) {
      // Update status to failed
      upload.status = 'failed';
      upload.errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await upload.save();

      this.logger.error(
        `[parse-pdf] Parse failed after ${Date.now() - startedAt}ms`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  /**
   * Get details of an uploaded question paper
   * @param uploadId Upload ID
   * @returns Upload details
   */
  async getUploadDetails(
    uploadId: string,
  ): Promise<GetUploadDetailsResponseDto> {
    if (!Types.ObjectId.isValid(uploadId)) {
      throw new BadRequestException(`Invalid upload ID: ${uploadId}`);
    }

    const upload = await this.questionUploadModel.findById(
      new Types.ObjectId(uploadId),
    );

    if (!upload) {
      throw new NotFoundException(`Upload not found with ID: ${uploadId}`);
    }

    const uploadObj = upload.toObject();

    return {
      id: uploadObj.id,
      title: upload.title,
      filename: upload.filename,
      s3Key: upload.s3Key,
      fileSize: upload.fileSize,
      status: upload.status,
      subjectId: upload.subject?.toString(),
      topicId: upload.topic?.toString(),
      examIds: upload.exams?.map(id => id.toString()),
      markdownS3Key: upload.markdownS3Key,
      errorMessage: upload.errorMessage,
      enrichedAt: upload.enrichedAt,
      enrichmentStats: upload.enrichmentStats,
      enrichedQuestionCount: upload.enrichedQuestions?.length ?? 0,
      rejectedQuestionCount:
        await this.failedQuestionService.countByUpload(uploadId),
      createdAt: upload.createdAt ?? new Date(),
      updatedAt: upload.updatedAt ?? new Date(),
    };
  }

  /**
   * List uploaded question papers with categorization (parsed vs unparsed)
   * @param page Page number (1-based)
   * @param limit Items per page
   * @returns Categorized list of uploads (parsed and unparsed)
   */
  async listUploads(
    page: number = 1,
    limit: number = 10,
  ): Promise<UploadsListResponseDto> {
    const skip = (page - 1) * limit;

    const [allUploads, total] = await Promise.all([
      this.questionUploadModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.questionUploadModel.countDocuments(),
    ]);

    const uploads: UploadMetadataDto[] = allUploads.map(upload => {
      const uploadObj = upload.toObject();
      return {
        id: uploadObj.id,
        title: upload.title,
        filename: upload.filename,
        fileSize: upload.fileSize,
        status: upload.status,
        subjectId: upload.subject?.toString(),
        topicId: upload.topic?.toString(),
        examIds: upload.exams?.map(id => id.toString()),
        s3Key: upload.s3Key,
        markdownS3Key: upload.markdownS3Key,
        errorMessage: upload.errorMessage,
        createdAt: upload.createdAt ?? new Date(),
        updatedAt: upload.updatedAt ?? new Date(),
      };
    });

    return {
      uploads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get markdown content from S3 for a parsed upload
   * @param uploadId Upload ID
   * @returns Markdown content as string
   */
  async getMarkdownContent(uploadId: string): Promise<string> {
    if (!Types.ObjectId.isValid(uploadId)) {
      throw new BadRequestException(`Invalid upload ID: ${uploadId}`);
    }

    const upload = await this.questionUploadModel.findById(
      new Types.ObjectId(uploadId),
    );

    if (!upload) {
      throw new NotFoundException(`Upload not found with ID: ${uploadId}`);
    }

    if (!upload.markdownS3Key) {
      throw new BadRequestException(
        'Markdown not yet parsed. Please parse the PDF first using /imports/parse-pdf/:uploadId',
      );
    }

    this.logger.log(
      `[get-markdown] Fetching markdown from S3: ${upload.markdownS3Key}`,
    );

    // Download markdown from S3
    const markdownData = await this.s3Service.downloadFile(
      upload.markdownS3Key,
      upload.s3Bucket,
    );

    const markdown = markdownData.body.toString('utf-8');

    this.logger.log(
      `[get-markdown] Retrieved markdown (${markdown.length} chars) for upload_id=${uploadId}`,
    );

    return markdown;
  }
}
