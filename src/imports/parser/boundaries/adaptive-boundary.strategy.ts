import { Injectable, Logger } from '@nestjs/common';
import { DocumentStructure } from '../../types/document-structure';
import {
  ParsedQuestionStart,
  QuestionBoundaryStrategy,
} from './question-boundary.strategy';

/**
 * Adaptive boundary strategy that uses AI-detected document structure
 * to identify question boundaries dynamically
 */
@Injectable()
export class AdaptiveBoundaryStrategy implements QuestionBoundaryStrategy {
  private readonly logger = new Logger(AdaptiveBoundaryStrategy.name);
  private regex: RegExp | null = null;
  private structure: DocumentStructure | null = null;

  /**
   * Initialize for parsing the solutions/answers section (may use different numbering).
   */
  initializeForSolutions(structure: DocumentStructure): void {
    const solutionRegex =
      structure.solutionPattern.numberingRegex ??
      (structure.solutionPattern.matchesQuestionNumbering
        ? structure.questionPattern.regex
        : undefined);

    if (!solutionRegex) {
      this.initialize(structure);
      return;
    }

    this.structure = {
      ...structure,
      questionPattern: {
        ...structure.questionPattern,
        regex: solutionRegex,
        type: solutionRegex.includes('Q(') ? 'labeled' : 'numbered',
      },
    };

    try {
      this.regex = new RegExp(solutionRegex);
      this.logger.log(
        `[adaptive-boundary] Initialized for solutions with pattern: ${solutionRegex}`,
      );
    } catch (error) {
      this.logger.error(
        `[adaptive-boundary] Invalid solution regex: ${solutionRegex}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.initialize(structure);
    }
  }

  /**
   * Build a dedicated boundary strategy for the solutions section.
   */
  createSolutionBoundary(structure: DocumentStructure): AdaptiveBoundaryStrategy {
    const boundary = new AdaptiveBoundaryStrategy();
    boundary.initializeForSolutions(structure);
    return boundary;
  }

  /**
   * Initialize the strategy with detected document structure
   * @param structure Document structure detected by StructureDetectorService
   */
  initialize(structure: DocumentStructure): void {
    this.structure = structure;

    try {
      this.regex = new RegExp(structure.questionPattern.regex);
      this.logger.log(
        `[adaptive-boundary] Initialized with pattern: ${structure.questionPattern.regex} (type=${structure.questionPattern.type})`,
      );
    } catch (error) {
      this.logger.error(
        `[adaptive-boundary] Invalid regex pattern: ${structure.questionPattern.regex}`,
        error instanceof Error ? error.stack : String(error),
      );
      // Fallback to numbered question pattern
      this.regex = /^(\d+)\.\s(.*)$/;
      this.logger.warn(
        '[adaptive-boundary] Using fallback pattern: ^(\\d+)\\.\\s(.*)$',
      );
    }
  }

  /**
   * Check if a line marks the start of a new question
   * @param line Line of text to check
   * @returns true if line starts a question
   */
  isQuestionStart(line: string): boolean {
    if (!this.regex) {
      throw new Error(
        'AdaptiveBoundaryStrategy not initialized. Call initialize() first.',
      );
    }

    return this.regex.test(line.trim());
  }

  /**
   * Parse question start line to extract question number and content
   * @param line Line of text to parse
   * @returns Parsed question start or null if line doesn't match pattern
   */
  parseQuestionStart(line: string): ParsedQuestionStart | null {
    if (!this.regex || !this.structure) {
      throw new Error(
        'AdaptiveBoundaryStrategy not initialized. Call initialize() first.',
      );
    }

    const trimmedLine = line.trim();
    const match = trimmedLine.match(this.regex);

    if (!match) {
      return null;
    }

    // Extract question number from capture groups or the matched line
    const questionNumber = this.extractQuestionNumber(match, trimmedLine);
    if (questionNumber === null) {
      this.logger.warn(
        `[adaptive-boundary] Could not extract question number from line: ${trimmedLine}`,
      );
      return null;
    }

    // Extract content (everything after the number/label)
    const content = this.extractContent(match, trimmedLine);

    return {
      number: questionNumber,
      content,
    };
  }

  /**
   * Extract question number from regex match
   * Handles different numbering schemes (numbered, labeled, hierarchical)
   */
  private extractQuestionNumber(
    match: RegExpMatchArray,
    fullLine: string,
  ): number | null {
    if (!this.structure) return null;

    // First capture group should contain the number/label when present
    const captured = match[1];
    if (captured) {
      const fromCapture = this.parseQuestionNumberToken(captured);
      if (fromCapture !== null) {
        return fromCapture;
      }
    }

    // Fallback when the detected regex lacks a capture group (common LLM output)
    const fromLine = this.extractQuestionNumberFromText(fullLine);
    if (fromLine !== null) {
      return fromLine;
    }

    return this.extractQuestionNumberFromText(match[0]);
  }

  private parseQuestionNumberToken(token: string): number | null {
    if (!this.structure) return null;

    switch (this.structure.questionPattern.type) {
      case 'numbered':
        return parseInt(token, 10);

      case 'labeled': {
        const numMatch = token.match(/\d+/);
        return numMatch ? parseInt(numMatch[0], 10) : null;
      }

      case 'hierarchical': {
        const hierarchicalMatch = token.match(/^(\d+)/);
        return hierarchicalMatch ? parseInt(hierarchicalMatch[1], 10) : null;
      }

      default:
        return parseInt(token, 10);
    }
  }

  /**
   * Best-effort extraction from a question heading line without capture groups.
   */
  private extractQuestionNumberFromText(text: string): number | null {
    const patterns = [
      /\\section\*\{Q(?:uestion)?\s*(\d+)\./i,
      /\bQ(?:uestion)?\s*(\d+)\b/i,
      /^#+\s*Q(?:uestion)?\s*(\d+)\b/i,
      /^(\d+)\.\s/,
      /^(\d+)\)\s/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  /**
   * Extract content after question number/label
   */
  private extractContent(match: RegExpMatchArray, fullLine: string): string {
    // If there's a second capture group, use it
    if (match[2] !== undefined) {
      return match[2];
    }

    // Otherwise, remove the matched prefix from the line
    const matchedText = match[0];
    return fullLine.substring(matchedText.length).trim();
  }

  /**
   * Get the current document structure (for debugging/logging)
   */
  getStructure(): DocumentStructure | null {
    return this.structure;
  }

  /**
   * Check if strategy has been initialized
   */
  isInitialized(): boolean {
    return this.regex !== null && this.structure !== null;
  }
}
