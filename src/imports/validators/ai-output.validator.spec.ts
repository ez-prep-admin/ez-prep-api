import { Test, TestingModule } from '@nestjs/testing';
import {
  AiOutputValidator,
  AiOutputValidationError,
} from './ai-output.validator';

const validQuestion = {
  questionText: 'What is 2+2?',
  options: [
    { label: 'a', text: '3' },
    { label: 'b', text: '4' },
    { label: 'c', text: '5' },
    { label: 'd', text: '6' },
  ],
  correctAnswer: 'b',
  explanation: 'Addition.',
  difficultyLevel: 'easy',
};

describe('AiOutputValidator', () => {
  let validator: AiOutputValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiOutputValidator],
    }).compile();
    validator = module.get(AiOutputValidator);
  });

  it('validates a single question JSON object', () => {
    const result = validator.validate(JSON.stringify(validQuestion));
    expect(result.questionText).toBe('What is 2+2?');
    expect(result.correctAnswer).toBe('b');
  });

  it('validates a batch payload', () => {
    const questions = validator.validateBatch(
      JSON.stringify({ questions: [{ ...validQuestion, number: 1 }] }),
    );
    expect(questions).toHaveLength(1);
    expect(questions[0].number).toBe(1);
  });

  it('throws on schema failure for a single payload', () => {
    expect(() =>
      validator.validate(JSON.stringify({ questionText: '' })),
    ).toThrow(AiOutputValidationError);
  });

  it('throws on schema failure for a batch payload', () => {
    expect(() =>
      validator.validateBatch(JSON.stringify({ questions: [] })),
    ).toThrow(AiOutputValidationError);
  });

  it('throws a truncation error when finishReason is length and JSON is invalid', () => {
    expect(() => validator.validate('{', { finishReason: 'length' })).toThrow(
      /truncated before valid JSON/,
    );
  });

  it('throws a generic JSON error when finishReason is not length', () => {
    expect(() => validator.validateBatch('not-json')).toThrow(/not valid JSON/);
  });
});
