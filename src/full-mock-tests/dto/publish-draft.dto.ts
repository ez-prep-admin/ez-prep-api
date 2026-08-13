import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class PublishDraftDto {
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
