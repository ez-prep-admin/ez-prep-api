import { Injectable, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import {
  AiQuestionBatchItem,
  AiQuestionOutput,
} from '../types/ai-question-output';
import {
  AiQuestionBatchOutputSchema,
  AiQuestionOutputSchema,
} from '../prompt/schemas';
import { jsonPreview, salvageJson } from '../utils/json-salvage.util';

export class AiOutputValidationError extends Error {
  constructor(
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'AiOutputValidationError';
  }
}

export interface AiOutputValidationContext {
  chunkIndex?: number;
  questionNumbers?: number[];
  finishReason?: string | null;
  completionTokens?: number | null;
  responseChars?: number;
}

@Injectable()
export class AiOutputValidator {
  private readonly logger = new Logger(AiOutputValidator.name);

  validate(
    rawJson: string,
    context: AiOutputValidationContext = {},
  ): AiQuestionOutput {
    const parsed = this.parseModelJson(rawJson, context, 'single');

    try {
      return AiQuestionOutputSchema.parse(parsed);
    } catch (error) {
      if (error instanceof ZodError) {
        this.logSchemaFailure('single', context, error);
        throw new AiOutputValidationError(
          'Model response failed schema validation.',
          error.issues.map(
            issue => `${issue.path.join('.') || 'root'}: ${issue.message}`,
          ),
        );
      }

      throw error;
    }
  }

  validateBatch(
    rawJson: string,
    context: AiOutputValidationContext = {},
  ): AiQuestionBatchItem[] {
    const parsed = this.parseModelJson(rawJson, context, 'batch');

    try {
      const result = AiQuestionBatchOutputSchema.parse(parsed);
      this.logger.log(
        `[zod] Batch schema validated ${result.questions.length} question(s)`,
      );
      return result.questions;
    } catch (error) {
      if (error instanceof ZodError) {
        this.logSchemaFailure('batch', context, error);
        throw new AiOutputValidationError(
          'Model batch response failed schema validation.',
          error.issues.map(
            issue => `${issue.path.join('.') || 'root'}: ${issue.message}`,
          ),
        );
      }

      throw error;
    }
  }

  private parseModelJson(
    rawJson: string,
    context: AiOutputValidationContext,
    mode: 'single' | 'batch',
  ): unknown {
    try {
      const result = salvageJson(rawJson);

      if (result.strategy !== 'direct') {
        this.logger.warn(
          `[json] Recovered model JSON via ${result.strategy} (${this.formatContext(context)})`,
        );
      }

      return result.parsed;
    } catch (error) {
      const syntaxMessage =
        error instanceof SyntaxError ? error.message : 'Unknown parse error';

      this.logger.error(
        `[json] Failed to parse model JSON (${this.formatContext(context)}): ${syntaxMessage}; ` +
          `finish_reason=${context.finishReason ?? 'n/a'}, ` +
          `completion_tokens=${context.completionTokens ?? 'n/a'}, ` +
          `chars=${context.responseChars ?? rawJson.length}; ` +
          `preview="${jsonPreview(rawJson)}"`,
      );

      if (context.finishReason === 'length') {
        throw new AiOutputValidationError(
          mode === 'batch'
            ? 'Model batch response was truncated before valid JSON could be produced.'
            : 'Model response was truncated before valid JSON could be produced.',
        );
      }

      throw new AiOutputValidationError(
        mode === 'batch'
          ? 'Model batch response is not valid JSON.'
          : 'Model response is not valid JSON.',
      );
    }
  }

  private logSchemaFailure(
    mode: 'single' | 'batch',
    context: AiOutputValidationContext,
    error: ZodError,
  ): void {
    const issues = error.issues
      .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');

    this.logger.error(
      `[zod] ${mode} schema validation failed (${this.formatContext(context)}): ${issues}`,
    );
  }

  private formatContext(context: AiOutputValidationContext): string {
    const parts: string[] = [];

    if (context.chunkIndex !== undefined) {
      parts.push(`chunk=${context.chunkIndex}`);
    }

    if (context.questionNumbers?.length) {
      parts.push(`questions=[${context.questionNumbers.join(', ')}]`);
    }

    return parts.length > 0 ? parts.join(', ') : 'no context';
  }
}
