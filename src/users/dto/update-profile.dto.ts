import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  MaxLength,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../common/enums/gender.enum';

export class LocationDto {
  @ApiPropertyOptional({ description: 'City', example: 'Hyderabad' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'State / Province',
    example: 'Telangana',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'India' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone string',
    example: 'Asia/Kolkata',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Short bio / about the user (max 500 characters)',
    example: 'Aspiring civil servant preparing for UPSC 2026.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'URL to the user avatar / profile picture',
    example: 'https://cdn.example.com/avatars/user123.jpg',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Date of birth (ISO 8601)',
    example: '2000-05-11',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Gender',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Location details', type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    description: 'ID of the target exam the user is preparing for',
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
