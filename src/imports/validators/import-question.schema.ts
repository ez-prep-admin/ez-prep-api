import { z } from 'zod';
import { PDF_IMPORT_QUESTION_SOURCE } from '../types/import-question';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

export const ImportImageMetadataSchema = z.object({
  key: z.string().trim().min(1),
  bucket: z.string().trim().min(1),
  region: z.string().trim().min(1),
  contentType: z.string().trim().optional(),
  size: z.number().optional(),
  lastModified: z.coerce.date().optional(),
  url: z.string().url().optional(),
});

export const ImportQuestionOptionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['text', 'image']),
  en: z.string().trim().min(1).nullable().optional(),
  ml: z.null().optional(),
  image: ImportImageMetadataSchema.nullable().optional(),
});

export const ImportQuestionSchema = z
  .object({
    questionText: z.object({
      en: z.object({
        text: z.string().nullable().optional(),
        image: ImportImageMetadataSchema.nullable().optional(),
      }),
      ml: z.object({
        text: z.null(),
        image: z.null(),
      }),
    }),
    optionType: z.enum(['text', 'image']),
    options: z.array(ImportQuestionOptionSchema).min(1),
    explanation: z.object({
      en: z.string().trim().min(1),
      ml: z.null().optional(),
      image: ImportImageMetadataSchema.nullable().optional(),
    }),
    correctAnswer: z.string().uuid(),
    subject: objectIdSchema,
    topic: objectIdSchema,
    exams: z.array(objectIdSchema).min(1),
    difficultyLevel: z.enum(['easy', 'medium', 'hard']),
    isActive: z.boolean().default(true),
    isDeleted: z.boolean().default(false),
    source: z
      .literal(PDF_IMPORT_QUESTION_SOURCE)
      .default(PDF_IMPORT_QUESTION_SOURCE),
  })
  .superRefine((question, ctx) => {
    const hasQuestionText = Boolean(question.questionText.en.text?.trim());
    const hasQuestionImage = Boolean(question.questionText.en.image?.url);

    if (!hasQuestionText && !hasQuestionImage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Question must include English text or an image.',
        path: ['questionText', 'en'],
      });
    }

    const optionIds = question.options.map(option => option.id);
    const uniqueOptionIds = new Set(optionIds);

    if (uniqueOptionIds.size !== optionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate option ids are not allowed.',
        path: ['options'],
      });
    }

    if (!uniqueOptionIds.has(question.correctAnswer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctAnswer must match one of the option ids.',
        path: ['correctAnswer'],
      });
    }

    const optionTexts = question.options
      .map(option => option.en?.trim().toLowerCase())
      .filter(Boolean);
    const uniqueOptionTexts = new Set(optionTexts);

    if (uniqueOptionTexts.size !== optionTexts.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate option text values are not allowed.',
        path: ['options'],
      });
    }
  });

export const PersistQuestionsBodySchema = z.object({
  questions: z.array(ImportQuestionSchema).min(1),
  errors: z.array(z.unknown()).optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
});
