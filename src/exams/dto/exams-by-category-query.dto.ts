import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoryScope } from '../../categories/enums/category-scope.enum';
import { INDIA_STATE_CODES } from '../../categories/india-states';

export class ExamsByCategoryQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter categories by jurisdiction. Defaults to central (excludes state PSC categories). Pass state with stateCode to list a state’s categories.',
    enum: CategoryScope,
    example: CategoryScope.CENTRAL,
    default: CategoryScope.CENTRAL,
  })
  @IsOptional()
  @IsEnum(CategoryScope)
  scope?: CategoryScope;

  @ApiPropertyOptional({
    description:
      'ISO 3166-2:IN two-letter state code. Required when scope is state.',
    example: 'KL',
    enum: INDIA_STATE_CODES,
  })
  @ValidateIf(o => o.scope === CategoryScope.STATE)
  @IsIn(INDIA_STATE_CODES, {
    message: 'stateCode must be a valid ISO 3166-2:IN code',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  stateCode?: string;
}
