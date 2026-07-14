import { z } from 'zod';

const optionLabelSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-e]$/);

export const AiQuestionOptionSchema = z.object({
  label: optionLabelSchema,
  text: z.string().trim().min(1),
});

export const AiQuestionOutputSchema = z.object({
  questionText: z.string().trim().min(1),
  options: z.array(AiQuestionOptionSchema).min(1),
  correctAnswer: optionLabelSchema,
  explanation: z.string().trim().min(1),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']),
});

export const AiQuestionBatchItemSchema = AiQuestionOutputSchema.extend({
  number: z.number().int().positive(),
});

export const AiQuestionBatchOutputSchema = z.object({
  questions: z.array(AiQuestionBatchItemSchema).min(1),
});

export const AI_QUESTION_OUTPUT_JSON_SHAPE = {
  questionText:
    'string — full question stem in English; keep Mathpix/LaTeX exactly (\\(...\\), \\[...\\], $...$, \\%, \\frac, etc.)',
  options: [
    {
      label: 'a | b | c | d (lowercase)',
      text: 'string — option text only, without the label prefix; preserve LaTeX as in source',
    },
  ],
  correctAnswer: 'a | b | c | d — must match one option label',
  explanation:
    'string — step-by-step explanation in English from the solution; preserve LaTeX math delimiters from the source',
  difficultyLevel: 'easy | medium | hard',
} as const;

export const AI_QUESTION_BATCH_OUTPUT_JSON_SHAPE = {
  questions: [
    {
      number: 'integer — question number from the input',
      ...AI_QUESTION_OUTPUT_JSON_SHAPE,
    },
  ],
} as const;
