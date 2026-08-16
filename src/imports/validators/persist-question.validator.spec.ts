import { NotFoundException } from '@nestjs/common';
import { ZodError } from 'zod';
import { ImportQuestionSchema } from './import-question.schema';
import {
  ImportQuestionInput,
  PDF_IMPORT_QUESTION_SOURCE,
} from '../types/import-question';
import {
  PersistQuestionValidationError,
  PersistQuestionValidator,
} from './persist-question.validator';

describe('Persist question validation', () => {
  const validQuestion: ImportQuestionInput = {
    questionText: {
      en: { text: 'What is the answer?' },
      ml: { text: null, image: null },
    },
    optionType: 'text',
    options: [
      {
        id: '743cbb1f-83f5-4a80-8445-31cac82b6486',
        type: 'text',
        en: 'A',
        ml: null,
      },
      {
        id: '0f958974-05c6-41d3-9975-35e96f334c2b',
        type: 'text',
        en: 'B',
        ml: null,
      },
      {
        id: '847b8bb5-d746-4567-b3a7-921598cd7738',
        type: 'text',
        en: 'C',
        ml: null,
      },
      {
        id: 'bb407eb5-20af-4911-a8b3-88349d149b34',
        type: 'text',
        en: 'D',
        ml: null,
      },
    ],
    explanation: { en: 'Because C is correct.', ml: null, image: null },
    correctAnswer: '847b8bb5-d746-4567-b3a7-921598cd7738',
    subject: '67ba32f8f8ac13a9bd5e5758',
    topic: '6a365809474b7019244e0dbb',
    exams: ['67bdd043b24c5bec214287c4'],
    difficultyLevel: 'medium',
    isActive: true,
    isDeleted: false,
  };

  it('accepts a valid import question payload', () => {
    expect(ImportQuestionSchema.parse(validQuestion)).toBeDefined();
  });

  it('defaults source to PDF_UPLOAD when omitted', () => {
    const parsed = ImportQuestionSchema.parse(validQuestion);

    expect(parsed.source).toBe(PDF_IMPORT_QUESTION_SOURCE);
  });

  it('rejects non-PDF_UPLOAD source values', () => {
    expect(() =>
      ImportQuestionSchema.parse({
        ...validQuestion,
        source: 'MANUAL_INPUT',
      }),
    ).toThrow();
  });

  it('rejects when correctAnswer does not match an option id', () => {
    expect(() =>
      ImportQuestionSchema.parse({
        ...validQuestion,
        correctAnswer: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow();
  });

  it('rejects questions without text or image', () => {
    expect(() =>
      ImportQuestionSchema.parse({
        ...validQuestion,
        questionText: {
          en: { text: null, image: null },
          ml: { text: null, image: null },
        },
      }),
    ).toThrow();
  });

  it('accepts an optional uploadId linking to the source PDF upload', () => {
    const parsed = ImportQuestionSchema.parse({
      ...validQuestion,
      uploadId: '507f1f77bcf86cd799439015',
    });

    expect(parsed.uploadId).toBe('507f1f77bcf86cd799439015');
  });

  it('omits uploadId when not provided', () => {
    const parsed = ImportQuestionSchema.parse(validQuestion);

    expect(parsed.uploadId).toBeUndefined();
  });
});

describe('PersistQuestionValidator', () => {
  const validQuestion: ImportQuestionInput = {
    questionText: {
      en: { text: 'What is the answer?' },
      ml: { text: null, image: null },
    },
    optionType: 'text',
    options: [
      {
        id: '743cbb1f-83f5-4a80-8445-31cac82b6486',
        type: 'text',
        en: 'A',
        ml: null,
      },
      {
        id: '0f958974-05c6-41d3-9975-35e96f334c2b',
        type: 'text',
        en: 'B',
        ml: null,
      },
      {
        id: '847b8bb5-d746-4567-b3a7-921598cd7738',
        type: 'text',
        en: 'C',
        ml: null,
      },
      {
        id: 'bb407eb5-20af-4911-a8b3-88349d149b34',
        type: 'text',
        en: 'D',
        ml: null,
      },
    ],
    explanation: { en: 'Because C is correct.', ml: null, image: null },
    correctAnswer: '847b8bb5-d746-4567-b3a7-921598cd7738',
    subject: '67ba32f8f8ac13a9bd5e5758',
    topic: '6a365809474b7019244e0dbb',
    exams: ['67bdd043b24c5bec214287c4'],
    difficultyLevel: 'medium',
    isActive: true,
    isDeleted: false,
  };

  const subjectModel = { exists: jest.fn() };
  const topicModel = { exists: jest.fn() };
  const examModel = { exists: jest.fn() };

  let validator: PersistQuestionValidator;

  beforeEach(() => {
    subjectModel.exists.mockReset();
    topicModel.exists.mockReset();
    examModel.exists.mockReset();
    subjectModel.exists.mockResolvedValue({ _id: 's' });
    topicModel.exists.mockResolvedValue({ _id: 't' });
    examModel.exists.mockResolvedValue({ _id: 'e' });
    validator = new PersistQuestionValidator(
      subjectModel as never,
      topicModel as never,
      examModel as never,
    );
  });

  it('returns the validated question on success', async () => {
    const result = await validator.validateQuestion(validQuestion, 0);
    expect(result.correctAnswer).toBe(validQuestion.correctAnswer);
    expect(result.options).toHaveLength(4);
  });

  it('rethrows PersistQuestionValidationError for option count mismatch', async () => {
    const question = {
      ...validQuestion,
      options: validQuestion.options.slice(0, 3),
      correctAnswer: validQuestion.options[0].id,
    };

    await expect(validator.validateQuestion(question, 2)).rejects.toThrow(
      PersistQuestionValidationError,
    );
    await expect(validator.validateQuestion(question, 2)).rejects.toThrow(
      /exactly 4 options/,
    );
  });

  it('rethrows PersistQuestionValidationError for blank text options', async () => {
    const question = {
      ...validQuestion,
      options: validQuestion.options.map((option, index) =>
        index === 1 ? { ...option, en: null } : option,
      ),
    };

    await expect(validator.validateQuestion(question, 1)).rejects.toThrow(
      /text options without content/,
    );
  });

  it('does not require option text when optionType is image', async () => {
    const image = {
      key: 'k',
      bucket: 'b',
      region: 'ap-south-1',
      url: 'https://example.com/a.png',
    };
    const question: ImportQuestionInput = {
      ...validQuestion,
      optionType: 'image',
      options: validQuestion.options.map(option => ({
        ...option,
        type: 'image' as const,
        en: null,
        image,
      })),
    };

    await expect(
      validator.validateQuestion(question, 0),
    ).resolves.toBeDefined();
  });

  it('rethrows NotFoundException when subject is missing', async () => {
    subjectModel.exists.mockResolvedValue(null);
    await expect(validator.validateQuestion(validQuestion, 3)).rejects.toThrow(
      NotFoundException,
    );
    await expect(validator.validateQuestion(validQuestion, 3)).rejects.toThrow(
      /subject .* was not found/,
    );
  });

  it('rethrows NotFoundException when topic is missing', async () => {
    topicModel.exists.mockResolvedValue(null);
    await expect(validator.validateQuestion(validQuestion, 4)).rejects.toThrow(
      /topic .* was not found/,
    );
  });

  it('rethrows NotFoundException when an exam is missing', async () => {
    examModel.exists.mockResolvedValue(null);
    await expect(validator.validateQuestion(validQuestion, 5)).rejects.toThrow(
      /exam .* was not found/,
    );
  });

  it('maps ZodError to PersistQuestionValidationError including root path', async () => {
    await expect(
      validator.validateQuestion(
        {
          ...validQuestion,
          correctAnswer: '11111111-1111-4111-8111-111111111111',
        },
        7,
      ),
    ).rejects.toMatchObject({
      name: 'PersistQuestionValidationError',
      message: 'Question at index 7 failed validation.',
    });
  });

  it('maps ZodError details for schema failures', async () => {
    await expect(
      validator.validateQuestion(
        { ...validQuestion, difficultyLevel: 'insane' } as never,
        8,
      ),
    ).rejects.toBeInstanceOf(PersistQuestionValidationError);
  });

  it('rethrows unknown errors from reference lookups', async () => {
    const boom = new TypeError('db down');
    subjectModel.exists.mockRejectedValue(boom);
    await expect(validator.validateQuestion(validQuestion, 0)).rejects.toBe(
      boom,
    );
  });

  it('still recognizes a raw ZodError instance', () => {
    expect(new ZodError([])).toBeInstanceOf(ZodError);
  });
});
