import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';
import { DocumentStructure } from '../types/document-structure';
import {
  buildStructureDetectionUserPrompt,
  extractMarkdownSample,
  STRUCTURE_DETECTION_SYSTEM_PROMPT,
} from '../prompt/structure-detection.prompt';
import { normalizeDocumentStructure } from './document-structure.normalizer';
import {
  DEFAULT_CONTENT_PROFILE,
  normalizeContentProfileFromLlm,
  normalizeReasoningEffort,
} from '../utils/content-profile.util';

const ContentProfileSchema = z.object({
  requiresReasoning: z.coerce.boolean(),
  reasoningDomains: z.array(z.string()).default([]),
  reasoningEffort: z.preprocess(
    normalizeReasoningEffort,
    z.enum(['low', 'medium', 'high']).optional(),
  ),
  detectedSubjects: z.array(z.string()).optional(),
  confidence: z.coerce.number().min(0).max(1),
  rationale: z
    .union([z.string(), z.null()])
    .optional()
    .transform(value => value ?? undefined),
});

const ContentProfileInputSchema = z.preprocess(
  normalizeContentProfileFromLlm,
  ContentProfileSchema,
);

/**
 * Zod schema for validating structure detection response.
 * Uses preprocessing so minor LLM formatting differences don't fail the whole parse.
 */
const StructureDetectionSchema = z.object({
  questionPattern: z.object({
    type: z.preprocess(
      normalizeQuestionPatternType,
      z.enum(['numbered', 'labeled', 'hierarchical']),
    ),
    regex: z.string().min(1),
    exampleMatch: z.string().min(1),
    prefix: z
      .union([z.string(), z.null()])
      .optional()
      .transform(value => value ?? undefined),
  }),
  solutionPattern: z.object({
    location: z.preprocess(
      normalizeSolutionLocation,
      z.enum(['inline', 'separate', 'end-of-page', 'mixed']),
    ),
    marker: z
      .union([z.string(), z.null()])
      .optional()
      .transform(value => value ?? undefined),
    inlineFormat: z
      .union([z.string(), z.null()])
      .optional()
      .transform(value => value ?? undefined),
    matchesQuestionNumbering: z.coerce.boolean(),
    numberingRegex: z
      .union([z.string(), z.null()])
      .optional()
      .transform(value => value ?? undefined),
  }),
  delimiter: z.object({
    type: z.preprocess(
      normalizeDelimiterType,
      z.enum(['heading', 'blank-line', 'marker', 'page-break']),
    ),
    value: z
      .union([z.string(), z.null()])
      .optional()
      .transform(value => value ?? ''),
    confidence: z.coerce.number().min(0).max(1),
  }),
  metadata: z.object({
    hasDifficulty: z.coerce.boolean(),
    hasMarks: z.coerce.boolean(),
    hasSubjectLabels: z.coerce.boolean(),
    examType: z
      .union([z.string(), z.null()])
      .optional()
      .transform(value => value ?? undefined),
  }),
  detectedFormat: z.string().min(1),
  confidence: z.coerce.number().min(0).max(1),
  warnings: z.array(z.string()).optional(),
  contentProfile: ContentProfileInputSchema.catch(DEFAULT_CONTENT_PROFILE),
});

function normalizeQuestionPatternType(value: unknown): QuestionPatternType {
  if (typeof value !== 'string') {
    return 'numbered';
  }

  const normalized = value.toLowerCase().trim();
  if (normalized.includes('hierarch')) return 'hierarchical';
  if (normalized.includes('label')) return 'labeled';
  return 'numbered';
}

function normalizeSolutionLocation(value: unknown): SolutionLocation {
  if (typeof value !== 'string') {
    return 'separate';
  }

  const normalized = value.toLowerCase().trim();
  if (normalized.includes('inline')) return 'inline';
  if (normalized.includes('mixed')) return 'mixed';
  if (normalized.includes('page')) return 'end-of-page';
  if (
    normalized.includes('separate') ||
    normalized.includes('section') ||
    normalized.includes('distinct')
  ) {
    return 'separate';
  }

  return 'separate';
}

function normalizeDelimiterType(value: unknown): DelimiterType {
  if (typeof value !== 'string') {
    return 'blank-line';
  }

  const normalized = value.toLowerCase().trim();
  if (normalized.includes('heading')) return 'heading';
  if (normalized.includes('marker')) return 'marker';
  if (normalized.includes('page')) return 'page-break';
  return 'blank-line';
}

type QuestionPatternType = 'numbered' | 'labeled' | 'hierarchical';
type SolutionLocation = 'inline' | 'separate' | 'end-of-page' | 'mixed';
type DelimiterType = 'heading' | 'blank-line' | 'marker' | 'page-break';

@Injectable()
export class StructureDetectorService {
  private readonly logger = new Logger(StructureDetectorService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required.');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL:
        this.configService.get<string>('DEEPSEEK_BASE_URL') ??
        'https://api.deepseek.com',
      timeout: 2 * 60 * 1000, // 2 minutes for structure detection
    });
    this.model =
      this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';

    this.logger.log(
      `[structure-detector] Client ready (model=${this.model}, timeout=120s)`,
    );
  }

  /**
   * Detect document structure from a markdown sample
   * @param markdown Full markdown content
   * @param sampleOptions Options for extracting sample
   * @returns Detected document structure
   */
  async detectStructure(
    markdown: string,
    sampleOptions?: {
      maxLines?: number;
      maxChars?: number;
      targetQuestions?: number;
      solutionSampleChars?: number;
    },
  ): Promise<DocumentStructure> {
    const startedAt = Date.now();

    // Extract sample for analysis (reduces token usage)
    const sample = extractMarkdownSample(markdown, sampleOptions);
    const sampleChars = sample.length;

    this.logger.log(
      `[structure-detector] Starting analysis (sample: ${sampleChars} chars)`,
    );

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: STRUCTURE_DETECTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildStructureDetectionUserPrompt(sample),
          },
        ],
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error(
          'DeepSeek returned an empty response for structure detection.',
        );
      }

      this.logger.log(
        `[structure-detector] LLM response received in ${Date.now() - startedAt}ms (tokens=${response.usage?.total_tokens ?? 'n/a'})`,
      );

      // Parse and validate response
      const structure = this.parseAndValidate(content);
      const normalized = normalizeDocumentStructure(markdown, structure);

      this.logger.log(
        `[structure-detector] Structure detected: ${normalized.detectedFormat} (confidence=${normalized.confidence})`,
      );

      this.logContentProfile(normalized.contentProfile);

      if (normalized.warnings && normalized.warnings.length > 0) {
        this.logger.warn(
          `[structure-detector] Warnings: ${normalized.warnings.join('; ')}`,
        );
      }

      return normalized;
    } catch (error) {
      this.logger.error(
        `[structure-detector] Failed after ${Date.now() - startedAt}ms`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Parse JSON response and validate against schema
   * @param jsonString Raw JSON string from LLM
   * @returns Validated DocumentStructure
   */
  private parseAndValidate(jsonString: string): DocumentStructure {
    try {
      const parsed: unknown = JSON.parse(jsonString);
      const validated = StructureDetectionSchema.parse(parsed);

      // Convert to DocumentStructure type (same shape, just for type safety)
      return validated as DocumentStructure;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        throw new Error(
          `Structure detection response validation failed: ${issues}`,
        );
      }
      throw new Error(
        `Failed to parse structure detection response: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate regex pattern by testing it
   * @param pattern Regex pattern string
   * @param testString String to test pattern against
   * @returns true if pattern is valid and matches test string
   */
  validatePattern(pattern: string, testString: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(testString);
    } catch {
      return false;
    }
  }

  private logContentProfile(
    profile: DocumentStructure['contentProfile'],
  ): void {
    if (!profile) {
      this.logger.warn(
        '[structure-detector] Content profile missing from LLM response',
      );
      return;
    }

    const domains =
      profile.reasoningDomains.length > 0
        ? profile.reasoningDomains.join(', ')
        : 'none';
    const effort = profile.reasoningEffort ?? 'n/a';

    this.logger.log(
      `[structure-detector] Content profile: requiresReasoning=${profile.requiresReasoning}, ` +
        `domains=[${domains}], effort=${effort}, confidence=${profile.confidence}` +
        (profile.rationale ? `, rationale="${profile.rationale}"` : ''),
    );
  }
}
