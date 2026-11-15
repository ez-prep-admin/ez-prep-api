import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateCategoryDto } from './create-category.dto';
import { CategoryScope } from '../enums/category-scope.enum';
import { INDIA_STATE_CODES } from '../india-states';

class CreateCategoryDtoWithoutScopeFields extends OmitType(CreateCategoryDto, [
  'scope',
  'stateCode',
] as const) {}

export class UpdateCategoryDto extends PartialType(
  CreateCategoryDtoWithoutScopeFields,
) {
  @ApiPropertyOptional({
    description: 'Active status of the category',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Exam jurisdiction. Central categories appear on the main dashboard. State categories appear on the State PSC page.',
    enum: CategoryScope,
    example: CategoryScope.CENTRAL,
  })
  @IsOptional()
  @IsEnum(CategoryScope, {
    message: 'Scope must be either central or state',
  })
  scope?: CategoryScope;

  @ApiPropertyOptional({
    description:
      'ISO 3166-2:IN two-letter state code (e.g. KL for Kerala). Required when the resulting scope is state.',
    example: 'KL',
    enum: INDIA_STATE_CODES,
  })
  @IsOptional()
  @IsString()
  @IsIn(INDIA_STATE_CODES, {
    message: 'State code must be a valid ISO 3166-2:IN code',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  stateCode?: string;
}
