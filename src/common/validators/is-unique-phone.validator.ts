import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

@ValidatorConstraint({ name: 'isUniquePhone', async: true })
@Injectable()
export class IsUniquePhoneConstraint implements ValidatorConstraintInterface {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async validate(
    phoneNumber: string,
    args: ValidationArguments,
  ): Promise<boolean> {
    if (!phoneNumber) return true; // Let other validators handle empty values

    const object = args.object as any;
    const userId = object.id || object._id;

    // Normalize phone number (remove all non-digits)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    // Build query to exclude current user (for updates)
    const query: any = { phoneNumber: normalizedPhone };
    if (userId) {
      query._id = { $ne: userId };
    }

    const existingUser = await this.userModel.findOne(query).exec();
    return !existingUser;
  }

  defaultMessage(args: ValidationArguments): string {
    return `Phone number '${args.value}' is already registered. Please use a different phone number.`;
  }
}

export function IsUniquePhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUniquePhoneConstraint,
    });
  };
}
