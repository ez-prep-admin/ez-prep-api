import { ValidationArguments } from 'class-validator';
import {
  IsProperName,
  IsProperNameConstraint,
} from './is-proper-name.validator';

describe('IsProperNameConstraint', () => {
  const constraint = new IsProperNameConstraint();
  const args = { value: 'x' } as ValidationArguments;

  it('should allow empty values', () => {
    expect(constraint.validate('', args)).toBe(true);
    expect(constraint.validate(undefined as any, args)).toBe(true);
  });

  it('should accept valid names', () => {
    expect(constraint.validate('John Doe', args)).toBe(true);
    expect(constraint.validate("O'Brien", args)).toBe(true);
    expect(constraint.validate('Jean-Luc', args)).toBe(true);
  });

  it('should reject invalid characters', () => {
    expect(constraint.validate('John123', args)).toBe(false);
    expect(constraint.validate('John@Doe', args)).toBe(false);
  });

  it('should reject whitespace-only after trim', () => {
    expect(constraint.validate('   ', args)).toBe(false);
  });

  it('should reject consecutive spaces', () => {
    expect(constraint.validate('John  Doe', args)).toBe(false);
  });

  it('should reject leading or trailing special characters', () => {
    expect(constraint.validate('-John', args)).toBe(false);
    expect(constraint.validate("John'", args)).toBe(false);
  });

  it('should provide a default message', () => {
    expect(constraint.defaultMessage({ value: 'bad!' } as ValidationArguments)).toContain(
      "Name 'bad!' is not valid",
    );
  });

  it('should register the decorator', () => {
    class Sample {
      @IsProperName()
      name: string;
    }
    expect(new Sample()).toBeDefined();
  });
});
