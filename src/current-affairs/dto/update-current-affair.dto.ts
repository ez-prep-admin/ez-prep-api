import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreateCurrentAffairDto } from './create-current-affair.dto';
import {
  DESCRIPTION_MAX_POINTS,
  DESCRIPTION_POINT_MAX_LENGTH,
  DESCRIPTION_POINT_MIN_LENGTH,
  cleanDescriptionPoints,
  sanitizeDescriptionPoints,
} from '../utils/description-points';

export class UpdateCurrentAffairDto extends PartialType(
  OmitType(CreateCurrentAffairDto, ['description'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Optional bullet points about the event. Up to 10 items. Empty strings are stripped on save. Send `[]` to clear an existing description.',
    type: [String],
    example: ['Updated first bullet', 'Updated second bullet'],
    maxItems: DESCRIPTION_MAX_POINTS,
  })
  @IsOptional()
  @ValidateIf(
    (_, value) => cleanDescriptionPoints(value).length > 0,
  )
  @IsArray()
  @ArrayMaxSize(DESCRIPTION_MAX_POINTS, {
    message: `Description cannot have more than ${DESCRIPTION_MAX_POINTS} bullet points`,
  })
  @IsString({ each: true })
  @MinLength(DESCRIPTION_POINT_MIN_LENGTH, {
    each: true,
    message: `Each description bullet must be at least ${DESCRIPTION_POINT_MIN_LENGTH} characters long`,
  })
  @MaxLength(DESCRIPTION_POINT_MAX_LENGTH, {
    each: true,
    message: `Each description bullet cannot exceed ${DESCRIPTION_POINT_MAX_LENGTH} characters`,
  })
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }
    return sanitizeDescriptionPoints(value);
  })
  description?: string[];

  @ApiPropertyOptional({
    description:
      'Active status. Inactive items are hidden from `activeOnly=true` lists used by the user-facing app. Soft-deleted items are never returned.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Display order within the same calendar date (0-based). Lower values appear first. If `date` is changed and `sortOrder` is omitted, the item is appended to the end of the new day.',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
