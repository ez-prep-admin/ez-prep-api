import { Test, TestingModule } from '@nestjs/testing';
import {
  BusinessValidator,
  BusinessValidationError,
} from './business.validator';
import { NEET_BUSINESS_VALIDATOR_CONFIG } from '../config/business-validator.config';
import { AiQuestionOutput } from '../types/ai-question-output';

const valid: AiQuestionOutput = {
  questionText: 'Stem',
  options: [
    { label: 'a', text: 'One' },
    { label: 'b', text: 'Two' },
    { label: 'c', text: 'Three' },
    { label: 'd', text: 'Four' },
  ],
  correctAnswer: 'a',
  explanation: 'Because.',
  difficultyLevel: 'medium',
};

describe('BusinessValidator', () => {
  let validator: BusinessValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessValidator],
    }).compile();
    validator = module.get(BusinessValidator);
  });

  it('returns the output when NEET rules pass', () => {
    expect(validator.validate(valid, NEET_BUSINESS_VALIDATOR_CONFIG)).toEqual(
      valid,
    );
  });

  it('rejects the wrong option count', () => {
    expect(() =>
      validator.validate(
        { ...valid, options: valid.options.slice(0, 2) },
        NEET_BUSINESS_VALIDATOR_CONFIG,
      ),
    ).toThrow(BusinessValidationError);
  });

  it('rejects duplicate labels and texts', () => {
    const dupLabels = {
      ...valid,
      options: [
        { label: 'a', text: 'One' },
        { label: 'a', text: 'Two' },
        { label: 'c', text: 'Three' },
        { label: 'd', text: 'Four' },
      ],
    };
    try {
      validator.validate(dupLabels, NEET_BUSINESS_VALIDATOR_CONFIG);
      throw new Error('expected validation error');
    } catch (error) {
      expect((error as BusinessValidationError).details).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Duplicate option labels/),
        ]),
      );
    }

    const dupText = {
      ...valid,
      options: [
        { label: 'a', text: 'Same' },
        { label: 'b', text: 'same' },
        { label: 'c', text: 'Three' },
        { label: 'd', text: 'Four' },
      ],
    };
    try {
      validator.validate(dupText, NEET_BUSINESS_VALIDATOR_CONFIG);
      throw new Error('expected validation error');
    } catch (error) {
      expect((error as BusinessValidationError).details).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Duplicate option text/),
        ]),
      );
    }
  });

  it('rejects missing labels, extra labels, and invalid correct answers', () => {
    const extraLabel = {
      ...valid,
      options: [
        { label: 'a', text: 'One' },
        { label: 'b', text: 'Two' },
        { label: 'c', text: 'Three' },
        { label: 'e', text: 'Five' },
      ],
      correctAnswer: 'z',
    };

    try {
      validator.validate(extraLabel, NEET_BUSINESS_VALIDATOR_CONFIG);
      fail('expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessValidationError);
      const details = (error as BusinessValidationError).details ?? [];
      expect(details.some(d => d.includes('Missing required'))).toBe(true);
      expect(details.some(d => d.includes('not allowed'))).toBe(true);
      expect(details.some(d => d.includes('not a valid option label'))).toBe(
        true,
      );
    }
  });

  it('requires explanation and allowed difficulty', () => {
    try {
      validator.validate(
        { ...valid, explanation: '   ' },
        NEET_BUSINESS_VALIDATOR_CONFIG,
      );
      throw new Error('expected validation error');
    } catch (error) {
      expect((error as BusinessValidationError).details).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Explanation is required/),
        ]),
      );
    }

    try {
      validator.validate(
        { ...valid, difficultyLevel: 'insane' as 'easy' },
        NEET_BUSINESS_VALIDATOR_CONFIG,
      );
      throw new Error('expected validation error');
    } catch (error) {
      expect((error as BusinessValidationError).details).toEqual(
        expect.arrayContaining([expect.stringMatching(/Difficulty/)]),
      );
    }
  });
});
