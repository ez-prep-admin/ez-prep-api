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
import { EnrichDebugResult, EnrichError } from './types/import-question';
import { AiOutputValidationError } from './validators/ai-output.validator';
import { BusinessValidationError } from './validators/business.validator';
import { QuestionChunkerService } from './chunking/question-chunker.service';
import { AiQuestionBatchItem } from './types/ai-question-output';

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
  ): Promise<EnrichDebugResult> {
    const startedAt = Date.now();
    const results: EnrichDebugResult['results'] = [];
    const errors: EnrichError[] = [];

    const chunks = this.questionChunker.chunk(matchedQuestions);
    this.logger.log(
      `[enrich] Starting batch enrichment: ${matchedQuestions.length} question(s) in ${chunks.length} chunk(s)`,
    );

    for (const chunk of chunks) {
      const chunkStartedAt = Date.now();
      const numbers = chunk.questions
        .map(question => question.number)
        .join(', ');

      this.logger.log(
        `[enrich] Chunk ${chunk.chunkIndex}: sending ${chunk.questions.length} question(s) to DeepSeek [${numbers}]`,
      );

      try {
        const rawJson = await this.deepseekService.extractQuestionsBatch(
          chunk.questions,
        );

        this.logger.log(
          `[enrich] Chunk ${chunk.chunkIndex}: DeepSeek responded in ${Date.now() - chunkStartedAt}ms`,
        );

        const batchOutputs = this.aiOutputValidator.validateBatch(rawJson);
        const returnedNumbers = new Set(
          batchOutputs.map(output => output.number),
        );

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

        for (const output of batchOutputs) {
          try {
            const matched = matchedByNumber.get(output.number);

            if (!matched) {
              continue;
            }

            const question = this.processBatchItem(output, matched);
            results.push({ number: output.number, question });
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
      } catch (error) {
        const enrichError = this.toEnrichError(0, error);
        const message =
          error instanceof Error ? error.message : 'Unknown chunk error';

        this.logger.error(
          `[enrich] Chunk ${chunk.chunkIndex} failed after ${Date.now() - chunkStartedAt}ms: ${message}`,
        );

        for (const matched of chunk.questions) {
          errors.push({
            number: matched.number,
            stage: enrichError.stage,
            message: `Chunk ${chunk.chunkIndex} failed: ${message}`,
          });
        }
      }
    }

    results.sort((left, right) => left.number - right.number);

    const summary = {
      total: matchedQuestions.length,
      success: results.length,
      failed: errors.length,
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `[enrich] Completed in ${summary.durationMs}ms — success=${summary.success}, failed=${summary.failed}`,
    );

    return {
      questions: results.map(result => result.question),
      results,
      errors,
      stats: {
        total: summary.total,
        success: summary.success,
        failed: summary.failed,
      },
    };
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
