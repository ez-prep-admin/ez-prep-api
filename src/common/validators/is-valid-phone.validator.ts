import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

@ValidatorConstraint({ name: 'isValidPhone', async: false })
export class IsValidPhoneConstraint implements ValidatorConstraintInterface {
  validate(phoneNumber: string, args: ValidationArguments): boolean {
    if (!phoneNumber) return true; // Let other validators handle empty values

    try {
      // Clean the phone number first
      const cleanedPhone = phoneNumber.trim();
      
      // Basic validation: must start with + and have at least 10 digits after +
      if (!cleanedPhone.startsWith('+')) {
        return false;
      }
      
      const digitsOnly = cleanedPhone.substring(1); // Remove the +
      if (!/^\d{10,15}$/.test(digitsOnly)) {
        return false; // Must be 10-15 digits after the +
      }
      
      // Use libphonenumber-js for detailed validation
      const isValid = isValidPhoneNumber(cleanedPhone);
      if (isValid) {
        return true;
      }
      
      // Try parsing for additional validation
      const parsed = parsePhoneNumber(cleanedPhone);
      return parsed ? parsed.isValid() : false;
      
    } catch (error) {
      // If libphonenumber-js fails, fall back to basic validation
      const digitsOnly = phoneNumber.replace(/[^\d]/g, '');
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `Phone number '${args.value}' is not valid. Please provide a valid phone number with country code (e.g., +1234567890).`;
  }
}

export function IsValidPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneConstraint,
    });
  };
}
