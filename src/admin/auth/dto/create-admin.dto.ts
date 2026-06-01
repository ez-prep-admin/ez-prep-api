import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsUniqueEmail } from '../../../common/validators/is-unique-email.validator';
import { IsUniquePhone } from '../../../common/validators/is-unique-phone.validator';
import { IsValidPhone } from '../../../common/validators/is-valid-phone.validator';
import { IsProperName } from '../../../common/validators/is-proper-name.validator';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Full name of the admin',
    example: 'Jane Admin',
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
    description: 'Admin email address',
    example: 'jane@ezprep.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsUniqueEmail({ message: 'This email address is already registered' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({
    description: 'Phone number with country code',
    example: '+919876543210',
  })
  @IsString({ message: 'Phone number must be a valid string' })
  @IsValidPhone({
    message: 'Please provide a valid phone number with country code',
  })
  @IsUniquePhone({ message: 'This phone number is already registered' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      let cleaned = value.trim().replace(/[^\d+]/g, '');
      if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
      }
      return cleaned;
    }
    return value;
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Admin password (min 8 characters)',
    example: 'SecurePass123',
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  password: string;
}
