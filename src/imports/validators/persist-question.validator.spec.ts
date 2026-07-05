import { ImportQuestionSchema } from './import-question.schema';
import {
  ImportQuestionInput,
  PDF_IMPORT_QUESTION_SOURCE,
} from '../types/import-question';

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
});
