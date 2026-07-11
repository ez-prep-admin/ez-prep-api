/**
 * Structure patterns detected by AI analysis of document sample
 */

export interface QuestionPattern {
  /**
   * Type of question numbering/labeling used
   * - numbered: Sequential numbers (1., 2., 3.)
   * - labeled: Letter or alphanumeric labels (Q1, A), B), etc.)
   * - hierarchical: Multi-level numbering (1.1, 1.2, 2.1, etc.)
   */
  type: 'numbered' | 'labeled' | 'hierarchical';

  /**
   * Regular expression pattern that matches question starts
   * Example: "^(\\d+)\\.\\s" for "1. Question text"
   */
  regex: string;

  /**
   * Example line that matches this pattern (for validation)
   */
  exampleMatch: string;

  /**
   * Optional: Prefix format if questions have consistent prefix
   * Example: "Q", "Question", etc.
   */
  prefix?: string;
}

export interface SolutionPattern {
  /**
   * Where solutions are located relative to questions
   * - inline: Solution immediately follows question
   * - separate: Solutions in separate section (e.g., at end)
   * - end-of-page: Solutions at bottom of each page
   * - mixed: Combination of above
   */
  location: 'inline' | 'separate' | 'end-of-page' | 'mixed';

  /**
   * Marker that indicates start of solutions section
   * Example: "## SOLUTIONS", "Answers:", "Answer Key"
   */
  marker?: string;

  /**
   * Format for inline solutions if applicable
   * Example: "Solution:", "Ans:", etc.
   */
  inlineFormat?: string;

  /**
   * Whether solutions use same numbering as questions
   */
  matchesQuestionNumbering: boolean;

  /**
   * Regex for solution entry lines when numbering differs from questions
   * (e.g. questions use "## Q1." but answers use "1. (2)").
   */
  numberingRegex?: string;
}

export interface DelimiterPattern {
  /**
   * Type of delimiter between questions/sections
   * - heading: Markdown headings (##, ###)
   * - blank-line: Empty lines
   * - marker: Special character sequences (---, ***)
   * - page-break: Page break markers
   */
  type: 'heading' | 'blank-line' | 'marker' | 'page-break';

  /**
   * The actual delimiter value/pattern
   */
  value: string;

  /**
   * Confidence level of delimiter detection (0-1)
   */
  confidence: number;
}

export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Content nature detected during structure analysis — used to decide whether
 * enrichment LLM calls should enable DeepSeek thinking/reasoning mode.
 */
export interface DocumentContentProfile {
  /**
   * Whether questions in this document typically need multi-step reasoning
   * (calculations, logic chains, reaction mechanisms, etc.) for accurate enrichment.
   */
  requiresReasoning: boolean;

  /**
   * Subject/content domains inferred from the sample (e.g. physics, chemistry,
   * quantitative aptitude, general intelligence and reasoning, biology).
   */
  reasoningDomains: string[];

  /**
   * Suggested reasoning depth when requiresReasoning is true.
   */
  reasoningEffort?: ReasoningEffort;

  /**
   * Optional subject labels spotted verbatim in the document sample.
   */
  detectedSubjects?: string[];

  /**
   * Confidence in the content profile assessment (0-1).
   */
  confidence: number;

  /**
   * Brief explanation of why reasoning is or is not needed.
   */
  rationale?: string;
}

export interface DocumentMetadata {
  /**
   * Whether document contains difficulty level indicators
   */
  hasDifficulty: boolean;

  /**
   * Whether document contains marks/points per question
   */
  hasMarks: boolean;

  /**
   * Whether document contains subject/topic labels
   */
  hasSubjectLabels: boolean;

  /**
   * Detected exam type if identifiable (NEET, JEE, etc.)
   */
  examType?: string;
}

/**
 * Complete document structure analysis result
 */
export interface DocumentStructure {
  /**
   * Pattern used to identify question boundaries
   */
  questionPattern: QuestionPattern;

  /**
   * Pattern describing solution organization
   */
  solutionPattern: SolutionPattern;

  /**
   * Delimiter patterns found in document
   */
  delimiter: DelimiterPattern;

  /**
   * Metadata fields detected in document
   */
  metadata: DocumentMetadata;

  /**
   * Human-readable format identifier
   * Example: "NEET Standard", "JEE Advanced", "Custom"
   */
  detectedFormat: string;

  /**
   * Overall confidence in structure detection (0-1)
   */
  confidence: number;

  /**
   * Any warnings or notes about the detection
   */
  warnings?: string[];

  /**
   * Content nature assessment for conditional enrichment reasoning mode.
   */
  contentProfile?: DocumentContentProfile;
}

/**
 * Validation schema for structure detection response
 */
export interface StructureDetectionResponse {
  questionPattern: {
    type: string;
    regex: string;
    exampleMatch: string;
    prefix?: string;
  };
  solutionPattern: {
    location: string;
    marker?: string;
    inlineFormat?: string;
    matchesQuestionNumbering: boolean;
    numberingRegex?: string;
  };
  delimiter: {
    type: string;
    value: string;
    confidence: number;
  };
  metadata: {
    hasDifficulty: boolean;
    hasMarks: boolean;
    hasSubjectLabels: boolean;
    examType?: string;
  };
  detectedFormat: string;
  confidence: number;
  warnings?: string[];
  contentProfile?: {
    requiresReasoning: boolean;
    reasoningDomains: string[];
    reasoningEffort?: ReasoningEffort;
    detectedSubjects?: string[];
    confidence: number;
    rationale?: string;
  };
}
