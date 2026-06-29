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

/**
 * Zod schema for validating structure detection response
 */
const StructureDetectionSchema = z.object({
  questionPattern: z.object({
    type: z.enum(['numbered', 'labeled', 'hierarchical']),
    regex: z.string().min(1),
    exampleMatch: z.string().min(1),
    prefix: z.string().optional(),
  }),
  solutionPattern: z.object({
    location: z.enum(['inline', 'separate', 'end-of-page', 'mixed']),
    marker: z.string().optional(),
    inlineFormat: z.string().optional(),
    matchesQuestionNumbering: z.boolean(),
  }),
  delimiter: z.object({
    type: z.enum(['heading', 'blank-line', 'marker', 'page-break']),
    value: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  metadata: z.object({
    hasDifficulty: z.boolean(),
    hasMarks: z.boolean(),
    hasSubjectLabels: z.boolean(),
    examType: z.string().optional(),
  }),
  detectedFormat: z.string().min(1),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).optional(),
});

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

      this.logger.log(
        `[structure-detector] Structure detected: ${structure.detectedFormat} (confidence=${structure.confidence})`,
      );

      if (structure.warnings && structure.warnings.length > 0) {
        this.logger.warn(
          `[structure-detector] Warnings: ${structure.warnings.join('; ')}`,
        );
      }

      return structure;
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
}
