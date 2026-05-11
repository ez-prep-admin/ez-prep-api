import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Type,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class EnhancedValidationPipe implements PipeTransform<unknown> {
  async transform(
    value: unknown,
    { metatype }: ArgumentMetadata,
  ): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      // Create detailed error response
      const formattedErrors = errors.map(error => ({
        field: error.property,
        value: error.value,
        constraints: Object.values(error.constraints || {}),
      }));

      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: 'ValidationError',
        message: 'Validation failed for the provided data',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
    }

    return object;
  }

  private toValidate(metatype: Type<unknown>): boolean {
    const types: Array<Type<unknown>> = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }
}
