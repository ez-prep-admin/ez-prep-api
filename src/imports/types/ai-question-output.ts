import { z } from 'zod';
import {
  AiQuestionBatchItemSchema,
  AiQuestionOutputSchema,
} from '../prompt/schemas';

export type AiQuestionOutput = z.infer<typeof AiQuestionOutputSchema>;
export type AiQuestionBatchItem = z.infer<typeof AiQuestionBatchItemSchema>;
