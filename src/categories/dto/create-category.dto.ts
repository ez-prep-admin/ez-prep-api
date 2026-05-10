import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name (e.g., Banking, SSC, Railways)',
    example: 'Banking',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Category name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    description: 'Short name/acronym (uppercase)',
    example: 'BANK',
    minLength: 2,
    maxLength: 20,
  })
  @IsString()
  @MinLength(2, { message: 'Short name must be at least 2 characters long' })
  @MaxLength(20, { message: 'Short name cannot exceed 20 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  shortName: string;

  @ApiPropertyOptional({
    description: 'Image URL for category icon/logo',
    example: 'https://example.com/images/banking.png',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid image URL' })
  @Transform(({ value }) => value?.trim())
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Competitive exams for banking sector jobs',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;
}
