import { Injectable } from '@nestjs/common';
import { AiQuestionOutput } from '../types/ai-question-output';
import { BusinessValidatorConfig } from '../config/business-validator.config';

export class BusinessValidationError extends Error {
  constructor(
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'BusinessValidationError';
  }
}

@Injectable()
export class BusinessValidator {
  validate(
    output: AiQuestionOutput,
    config: BusinessValidatorConfig,
  ): AiQuestionOutput {
    const errors: string[] = [];

    if (output.options.length !== config.optionCount) {
      errors.push(
        `Expected exactly ${config.optionCount} options, received ${output.options.length}.`,
      );
    }

    const labels = output.options.map(option => option.label);
    const uniqueLabels = new Set(labels);

    if (uniqueLabels.size !== labels.length) {
      errors.push('Duplicate option labels are not allowed.');
    }

    for (const expectedLabel of config.optionLabels) {
      if (!uniqueLabels.has(expectedLabel)) {
        errors.push(`Missing required option label "${expectedLabel}".`);
      }
    }

    for (const label of labels) {
      if (!config.optionLabels.includes(label)) {
        errors.push(
          `Option label "${label}" is not allowed for ${config.name}.`,
        );
      }
    }

    const optionTexts = output.options.map(option =>
      option.text.trim().toLowerCase(),
    );
    const uniqueTexts = new Set(optionTexts);

    if (uniqueTexts.size !== optionTexts.length) {
      errors.push('Duplicate option text values are not allowed.');
    }

    if (!config.optionLabels.includes(output.correctAnswer)) {
      errors.push(
        `Correct answer "${output.correctAnswer}" is not a valid option label.`,
      );
    }

    if (!labels.includes(output.correctAnswer)) {
      errors.push(
        `Correct answer "${output.correctAnswer}" does not match any provided option.`,
      );
    }

    if (config.requireExplanation && output.explanation.trim().length === 0) {
      errors.push('Explanation is required.');
    }

    if (!config.allowedDifficultyLevels.includes(output.difficultyLevel)) {
      errors.push(
        `Difficulty "${output.difficultyLevel}" is not allowed for ${config.name}.`,
      );
    }

    if (errors.length > 0) {
      throw new BusinessValidationError(
        'Model output failed business validation.',
        errors,
      );
    }

    return output;
  }
}
