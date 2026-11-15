import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsUrl,
  IsEnum,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryScope } from '../enums/category-scope.enum';
import { INDIA_STATE_CODES } from '../india-states';

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

  @ApiPropertyOptional({
    description:
      'Dashboard display priority. Higher values appear first in Popular Exams. Defaults to 0. Categories with the same priority are listed alphabetically.',
    example: 10,
    minimum: 0,
    maximum: 9999,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Priority must be a whole number' })
  @Min(0, { message: 'Priority cannot be negative' })
  @Max(9999, { message: 'Priority cannot exceed 9999' })
  priority?: number;

  @ApiPropertyOptional({
    description:
      'Exam jurisdiction. Central categories appear on the main dashboard. State categories appear on the State PSC page. Defaults to central.',
    enum: CategoryScope,
    example: CategoryScope.CENTRAL,
    default: CategoryScope.CENTRAL,
  })
  @IsOptional()
  @IsEnum(CategoryScope, {
    message: 'Scope must be either central or state',
  })
  scope?: CategoryScope;

  @ApiPropertyOptional({
    description:
      'ISO 3166-2:IN two-letter state code (e.g. KL for Kerala). Required when scope is state.',
    example: 'KL',
    enum: INDIA_STATE_CODES,
  })
  @ValidateIf(o => o.scope === CategoryScope.STATE)
  @IsString({ message: 'State code is required for state categories' })
  @IsIn(INDIA_STATE_CODES, {
    message: 'State code must be a valid ISO 3166-2:IN code',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  stateCode?: string;
}
