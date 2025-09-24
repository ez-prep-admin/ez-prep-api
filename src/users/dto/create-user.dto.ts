/* eslint-disable prettier/prettier */
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { IsUniqueEmail } from '../../common/validators/is-unique-email.validator';
import { IsUniquePhone } from '../../common/validators/is-unique-phone.validator';
import { IsValidPhone } from '../../common/validators/is-valid-phone.validator';
import { IsProperName } from '../../common/validators/is-proper-name.validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a valid string' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @IsProperName({
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Normalize spaces and convert to proper case
      return value
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return value;
  })
  name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsUniqueEmail({ message: 'This email address is already registered' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  email: string;

  @ApiProperty({
    description: 'Phone number with country code',
    example: '+1234567890',
  })
  @IsString({ message: 'Phone number must be a valid string' })
  @IsValidPhone({
    message: 'Please provide a valid phone number with country code',
  })
  @IsUniquePhone({ message: 'This phone number is already registered' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Clean the phone number but preserve the + sign
      let cleaned = value.trim().replace(/[^\d+]/g, '');

      // Ensure it starts with + if it doesn't already
      if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
      }

      return cleaned;
    }
    return value;
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'User role in the system',
    enum: UserRole,
    default: UserRole.USER,
    example: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role?: UserRole = UserRole.USER;
}
