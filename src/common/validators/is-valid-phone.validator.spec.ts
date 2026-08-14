import { ValidationArguments } from 'class-validator';
import {
  IsValidPhone,
  IsValidPhoneConstraint,
} from './is-valid-phone.validator';

jest.mock('libphonenumber-js', () => ({
  isValidPhoneNumber: jest.fn(),
  parsePhoneNumber: jest.fn(),
}));

import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

describe('IsValidPhoneConstraint', () => {
  const constraint = new IsValidPhoneConstraint();
  const args = { value: 'x' } as ValidationArguments;
  const isValidMock = isValidPhoneNumber as jest.Mock;
  const parseMock = parsePhoneNumber as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow empty values', () => {
    expect(constraint.validate('', args)).toBe(true);
  });

  it('should reject numbers that do not start with +', () => {
    expect(constraint.validate('1234567890', args)).toBe(false);
  });

  it('should reject + followed by non 10-15 digits', () => {
    expect(constraint.validate('+123', args)).toBe(false);
    expect(constraint.validate('+1234567890123456', args)).toBe(false);
    expect(constraint.validate('+12ab5678901', args)).toBe(false);
  });

  it('should accept numbers valid according to libphonenumber-js', () => {
    isValidMock.mockReturnValue(true);

    expect(constraint.validate('+14155552671', args)).toBe(true);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('should fall back to parsed.isValid()', () => {
    isValidMock.mockReturnValue(false);
    parseMock.mockReturnValue({ isValid: () => true });

    expect(constraint.validate('+14155552671', args)).toBe(true);
  });

  it('should return false when parse yields no number', () => {
    isValidMock.mockReturnValue(false);
    parseMock.mockReturnValue(undefined);

    expect(constraint.validate('+14155552671', args)).toBe(false);
  });

  it('should fall back to digit length when library throws', () => {
    isValidMock.mockImplementation(() => {
      throw new Error('parse fail');
    });

    expect(constraint.validate('+14155552671', args)).toBe(true);
    expect(constraint.validate('+123', args)).toBe(false);
  });

  it('should provide a default message', () => {
    expect(
      constraint.defaultMessage({ value: 'bad' } as ValidationArguments),
    ).toContain("Phone number 'bad' is not valid");
  });

  it('should register the decorator', () => {
    class Sample {
      @IsValidPhone()
      phone: string;
    }
    expect(new Sample()).toBeDefined();
  });
});
