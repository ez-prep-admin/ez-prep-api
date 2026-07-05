import { Injectable, Logger } from '@nestjs/common';
import { BaseQuestionPaperParser } from '../base-question-paper-parser.service';
import { ParserConfiguration } from '../../types/parser-configuration';
import { MarkdownParserService } from '../markdown-parser.service';
import { QuestionParserService } from '../question-parser.service';
import { SolutionParserService } from '../solution-parser.service';
import { QuestionMatcherService } from '../question-matcher.service';
import { AdaptiveBoundaryStrategy } from '../boundaries/adaptive-boundary.strategy';
import { QuestionBoundaryStrategy } from '../boundaries/question-boundary.strategy';
import { StructureDetectorService } from '../structure-detector.service';
import { normalizeDocumentStructure } from '../document-structure.normalizer';
import { DocumentStructure } from '../../types/document-structure';
import { MatchedQuestion } from '../../types/matched-question';
import {
  ParserError,
  ParserResult,
  ParserWarning,
} from '../../types/parser-result';

/**
 * Adaptive parser strategy that uses AI-powered structure detection
 * to handle any question paper format without hardcoded patterns
 */
@Injectable()
export class AdaptiveParserStrategy extends BaseQuestionPaperParser {
  private readonly logger = new Logger(AdaptiveParserStrategy.name);
  private cachedStructure: DocumentStructure | null = null;
  private structureWasSeeded = false;

  readonly configuration: ParserConfiguration = {
    parserName: 'adaptive',
    markers: {
      solutionsHeader: '', // Will be determined by structure detection
    },
  };

  constructor(
    markdownParser: MarkdownParserService,
    questionParser: QuestionParserService,
    solutionParser: SolutionParserService,
    matcher: QuestionMatcherService,
    private readonly structureDetector: StructureDetectorService,
    private readonly boundaryStrategy: AdaptiveBoundaryStrategy,
  ) {
    super(markdownParser, questionParser, solutionParser, matcher);
  }

  /**
   * Adaptive parser supports all markdown formats via AI structure detection.
   */
  supports(_markdown: string): boolean {
    return true;
  }

  /**
   * Get boundary strategy (initialized with detected structure)
   */
  getBoundaryStrategy(): QuestionBoundaryStrategy {
    if (!this.boundaryStrategy.isInitialized()) {
      throw new Error(
        'AdaptiveBoundaryStrategy not initialized. Ensure parseWithResult() is called first.',
      );
    }
    return this.boundaryStrategy;
  }

  /**
   * Parse markdown with structure detection and adaptive boundary strategy
   * Overrides base implementation to inject structure detection step
   */
  async parseWithResult(
    markdown: string,
  ): Promise<ParserResult<MatchedQuestion[]>> {
    try {
      let result = await this.executeParse(markdown);

      if (result.data.length === 0 && this.structureWasSeeded) {
        this.logger.warn(
          '[adaptive-parser] Seeded structure matched 0 questions; re-detecting with LLM',
        );
        this.clearCache();
        result = await this.executeParse(markdown);
      }

      return result;
    } catch (error) {
      this.logger.error(
        '[adaptive-parser] Parsing failed',
        error instanceof Error ? error.stack : String(error),
      );

      const parseError: ParserError = {
        code: 'ADAPTIVE_PARSE_FAILED',
        message: `Adaptive parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      };

      return {
        data: [],
        warnings: [],
        errors: [parseError],
      };
    }
  }

  private async executeParse(
    markdown: string,
  ): Promise<ParserResult<MatchedQuestion[]>> {
    try {
      // Step 1: Detect document structure (if not cached), then normalize against full markdown
      const rawStructure = await this.getOrDetectStructure(markdown);
      const structure = normalizeDocumentStructure(markdown, rawStructure);
      this.cachedStructure = structure;

      // Step 2: Initialize adaptive boundary strategy with detected structure
      this.boundaryStrategy.initialize(structure);

      // Step 3: Update configuration with detected markers
      this.configuration.markers.solutionsHeader =
        structure.solutionPattern.location === 'separate'
          ? (structure.solutionPattern.marker ?? '')
          : '';

      this.logger.log(
        `[adaptive-parser] Using detected format: ${structure.detectedFormat} (confidence=${structure.confidence}, solutions=${structure.solutionPattern.location})`,
      );

      // Step 4: Parse using base implementation with adaptive strategy
      const document = this.markdownParser.parse(
        markdown,
        this.configuration.markers,
      );
      const questionBoundary = this.getBoundaryStrategy();
      const solutionBoundary =
        structure.solutionPattern.location === 'separate'
          ? this.boundaryStrategy.createSolutionBoundary(structure)
          : questionBoundary;

      const questions = this.questionParser.parse(
        document.questionsSection,
        questionBoundary,
      );
      const solutions = this.solutionParser.parse(
        document.solutionsSection,
        solutionBoundary,
      );
      const { matched, warnings } = this.matcher.matchWithWarnings(
        questions,
        solutions,
      );

      const allWarnings: ParserWarning[] = [...warnings];

      for (const warning of structure.warnings ?? []) {
        allWarnings.push({
          code: 'STRUCTURE_DETECTION',
          message: `[Structure Detection] ${warning}`,
        });
      }

      if (structure.confidence < 0.7) {
        allWarnings.push({
          code: 'LOW_CONFIDENCE',
          message: `Low confidence in structure detection (${structure.confidence.toFixed(2)}). Results may be inaccurate.`,
        });
      }

      return {
        data: matched,
        warnings: allWarnings,
        errors: [],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cached structure or detect new structure
   * Caches structure per document to avoid redundant LLM calls
   */
  private async getOrDetectStructure(
    markdown: string,
  ): Promise<DocumentStructure> {
    // Check if we have cached structure
    // Note: In production, consider caching by document hash/ID
    if (this.cachedStructure) {
      this.logger.debug('[adaptive-parser] Using cached document structure');
      return this.cachedStructure;
    }

    // Detect structure using AI
    this.logger.log('[adaptive-parser] Detecting document structure...');
    const structure = await this.structureDetector.detectStructure(markdown, {
      maxChars: 8000,
      maxLines: 300,
      targetQuestions: 8,
      solutionSampleChars: 2000,
    });

    // Cache for this parsing session
    this.cachedStructure = structure;

    return structure;
  }

  /**
   * Clear cached structure (call when parsing new document)
   */
  clearCache(): void {
    this.cachedStructure = null;
    this.structureWasSeeded = false;
    this.logger.debug('[adaptive-parser] Cleared structure cache');
  }

  /**
   * Seed cached structure to skip redundant structure-detection LLM calls
   */
  seedStructure(structure: DocumentStructure): void {
    this.cachedStructure = structure;
    this.structureWasSeeded = true;
    this.logger.debug(
      `[adaptive-parser] Seeded cached structure (${structure.detectedFormat})`,
    );
  }

  /**
   * Get cached structure (for debugging/inspection)
   */
  getCachedStructure(): DocumentStructure | null {
    return this.cachedStructure;
  }
}
