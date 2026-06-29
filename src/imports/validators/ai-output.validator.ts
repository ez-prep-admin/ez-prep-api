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

export class AiOutputValidationError extends Error {
  constructor(
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'AiOutputValidationError';
  }
}

@Injectable()
export class AiOutputValidator {
  private readonly logger = new Logger(AiOutputValidator.name);

  validate(rawJson: string): AiQuestionOutput {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new AiOutputValidationError('Model response is not valid JSON.');
    }

    try {
      return AiQuestionOutputSchema.parse(parsed);
    } catch (error) {
      if (error instanceof ZodError) {
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

  validateBatch(rawJson: string): AiQuestionBatchItem[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new AiOutputValidationError(
        'Model batch response is not valid JSON.',
      );
    }

    try {
      const result = AiQuestionBatchOutputSchema.parse(parsed);
      this.logger.log(
        `[zod] Batch schema validated ${result.questions.length} question(s)`,
      );
      return result.questions;
    } catch (error) {
      if (error instanceof ZodError) {
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
}
