import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AccessMode } from '../../common/enums/access-mode.enum';

export class PublishSprintDraftDto {
  @ApiPropertyOptional({
    description:
      'Paper access mode. FREE = no entitlement required; ENTITLED = requires covering entitlement. Defaults to FREE.',
    enum: AccessMode,
    default: AccessMode.FREE,
  })
  @IsOptional()
  @IsEnum(AccessMode)
  accessMode?: AccessMode;

  @ApiPropertyOptional({
    description:
      'Overrides the draft title. Question count and duration cannot change here.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @ApiPropertyOptional({ description: 'Overrides the draft description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional({
    description:
      'Overrides marks for every correct answer on the published paper',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marksPerQuestion?: number;

  @ApiPropertyOptional({
    description:
      'Overrides the deduction for a wrong answer. Unanswered stays 0.',
    example: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  negativeMarking?: number;

  @ApiPropertyOptional({
    description: 'Absolute passing score. Omit to keep the draft value.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    description:
      'Overrides whether another attempt can be started after one is finished',
  })
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional({ description: 'Stored on the published paper' })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional({
    description: 'Include keys and explanations immediately after submit',
  })
  @IsOptional()
  @IsBoolean()
  showResultsImmediately?: boolean;
}
