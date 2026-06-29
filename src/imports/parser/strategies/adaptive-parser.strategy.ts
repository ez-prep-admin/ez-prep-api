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
   * Adaptive parser acts as fallback - supports any markdown
   * Returns true for any input, making it the last resort parser
   */
  supports(_markdown: string): boolean {
    // Adaptive parser supports any format as fallback
    // Should be registered last in DocumentParserFactory
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
      // Step 1: Detect document structure (if not cached)
      const structure = await this.getOrDetectStructure(markdown);

      // Step 2: Initialize adaptive boundary strategy with detected structure
      this.boundaryStrategy.initialize(structure);

      // Step 3: Update configuration with detected markers
      this.configuration.markers.solutionsHeader =
        structure.solutionPattern.marker ?? '';

      this.logger.log(
        `[adaptive-parser] Using detected format: ${structure.detectedFormat} (confidence=${structure.confidence})`,
      );

      // Step 4: Parse using base implementation with adaptive strategy
      const document = this.markdownParser.parse(
        markdown,
        this.configuration.markers,
      );
      const boundary = this.getBoundaryStrategy();

      const questions = this.questionParser.parse(
        document.questionsSection,
        boundary,
      );
      const solutions = this.solutionParser.parse(
        document.solutionsSection,
        boundary,
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
      maxChars: 5000,
      targetQuestions: 5,
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
    this.logger.debug('[adaptive-parser] Cleared structure cache');
  }

  /**
   * Get cached structure (for debugging/inspection)
   */
  getCachedStructure(): DocumentStructure | null {
    return this.cachedStructure;
  }
}
