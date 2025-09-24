import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isProperName', async: false })
export class IsProperNameConstraint implements ValidatorConstraintInterface {
  validate(name: string, _args: ValidationArguments): boolean {
    if (!name) return true; // Let other validators handle empty values

    // Check if name contains only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;

    if (!nameRegex.test(name)) {
      return false;
    }

    // Check for reasonable length and structure
    const trimmedName = name.trim();

    // Must not be just spaces or special characters
    if (trimmedName.length === 0) {
      return false;
    }

    // Must not have consecutive spaces
    if (/\s{2,}/.test(trimmedName)) {
      return false;
    }

    // Must not start or end with special characters
    if (/^[\s\-']|[\s\-']$/.test(trimmedName)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `Name '${args.value}' is not valid. Please use only letters, spaces, hyphens, and apostrophes. No consecutive spaces or leading/trailing special characters.`;
  }
}

export function IsProperName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsProperNameConstraint,
    });
  };
}
