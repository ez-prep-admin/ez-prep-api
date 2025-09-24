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

@ValidatorConstraint({ name: 'isUniqueEmail', async: true })
@Injectable()
export class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async validate(email: string, args: ValidationArguments): Promise<boolean> {
    if (!email) return true; // Let other validators handle empty values

    const object = args.object as any;
    const userId = object.id || object._id;

    // Build query to exclude current user (for updates)
    const query: any = { email: email.toLowerCase() };
    if (userId) {
      query._id = { $ne: userId };
    }

    const existingUser = await this.userModel.findOne(query).exec();
    return !existingUser;
  }

  defaultMessage(args: ValidationArguments): string {
    return `Email '${args.value}' is already registered. Please use a different email address.`;
  }
}

export function IsUniqueEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUniqueEmailConstraint,
    });
  };
}
