import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidPhone } from '../../common/validators/is-valid-phone.validator';
import { IsProperName } from '../../common/validators/is-proper-name.validator';
import { Gender } from '../../common/enums/gender.enum';
import { LocationDto } from './update-profile.dto';

/**
 * Unified DTO for the authenticated user to update their own profile.
 * Covers both core identity fields (name / email / phone) and extended
 * profile fields (bio, avatar, location, target exam, etc.) in a single
 * request — so the frontend needs just one PATCH /users/me call.
 *
 * Note: uniqueness checks for email/phone are enforced at the service layer,
 * not here, so we intentionally omit @IsUniqueEmail / @IsUniquePhone.
 */
export class UpdateMeDto {
  // ── Core identity ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Full name', example: 'Rahul Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsProperName({
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(
          (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join(' ');
    }
    return value;
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'rahul@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number with country code',
    example: '+911234567890',
  })
  @IsOptional()
  @IsString()
  @IsValidPhone({
    message: 'Please provide a valid phone number with country code',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      let cleaned = value.trim().replace(/[^\d+]/g, '');
      if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
      return cleaned;
    }
    return value;
  })
  phoneNumber?: string;

  // ── Extended profile ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Short bio (max 500 characters)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'Avatar / profile picture URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Date of birth (ISO 8601)',
    example: '2000-05-12',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Location details', type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    description: 'ID of the target exam',
    example: '64f123456789abcdef123456',
  })
  @IsOptional()
  @IsMongoId()
  targetExam?: string;

  @ApiPropertyOptional({
    description: 'Target exam date (ISO 8601)',
    example: '2026-06-15',
  })
  @IsOptional()
  @IsDateString()
  targetExamDate?: string;
}
