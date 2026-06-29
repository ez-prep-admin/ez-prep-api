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
      // Fallback to default NEET pattern
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

    // Extract question number from capture groups
    const questionNumber = this.extractQuestionNumber(match);
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
  private extractQuestionNumber(match: RegExpMatchArray): number | null {
    if (!this.structure) return null;

    // First capture group should contain the number/label
    const captured = match[1];
    if (!captured) return null;

    switch (this.structure.questionPattern.type) {
      case 'numbered':
        // Simple numeric: "1", "2", "3"
        return parseInt(captured, 10);

      case 'labeled':
        // Extract number from labels like "Q1", "Question 5"
        const numMatch = captured.match(/\d+/);
        return numMatch ? parseInt(numMatch[0], 10) : null;

      case 'hierarchical':
        // For hierarchical (1.1, 1.2), use last number or composite
        // For now, use first number as primary
        const hierarchicalMatch = captured.match(/^(\d+)/);
        return hierarchicalMatch ? parseInt(hierarchicalMatch[1], 10) : null;

      default:
        return parseInt(captured, 10);
    }
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
