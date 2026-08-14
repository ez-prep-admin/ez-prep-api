import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { CreateCurrentAffairDto } from './create-current-affair.dto';

export class UpdateCurrentAffairDto extends PartialType(
  CreateCurrentAffairDto,
) {
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
