import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExamGroupDto {
  @ApiProperty({
    description: 'Exam group name (e.g., UPSC CSE, JEE Advanced)',
    example: 'UPSC CSE',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, {
    message: 'Exam group name must be at least 2 characters long',
  })
  @MaxLength(100, { message: 'Exam group name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Short name/acronym',
    example: 'CSE',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Short name cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  shortName?: string;

  @ApiProperty({
    description: 'Category ID (e.g., Banking, SSC)',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId({ message: 'Category must be a valid MongoDB ObjectId' })
  category: string;

  @ApiPropertyOptional({
    description: 'Exam group description',
    example: 'Union Public Service Commission Civil Services Examination',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;
}
