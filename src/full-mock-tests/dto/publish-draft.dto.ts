import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class PublishDraftDto {
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
      'Title shown to students. Defaults to the exam name if omitted.',
    example: 'SSC CGL Tier 1 Full Mock 12',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional description shown on the student list',
    maxLength: 1000,
    example: 'Full-length paper matching the official CGL Tier 1 pattern',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description:
      'Whether students may start another attempt after completing one',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional({
    description:
      'Shuffle options within each subject block at attempt time. Does not reorder subjects.',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional({
    description:
      'Show correct answers and explanations immediately after submit',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showResultsImmediately?: boolean;

  @ApiPropertyOptional({
    description: 'Absolute passing score (not a percentage). Optional.',
    example: 120,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  passingScore?: number;
}
