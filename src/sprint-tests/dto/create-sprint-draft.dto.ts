import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const SPRINT_SIZE_OPTIONS = [10, 15, 20, 25, 30] as const;

export class CreateSprintDraftDto {
  @ApiProperty({ description: 'Exam the questions must be tagged to' })
  @IsMongoId()
  examId: string;

  @ApiProperty({ enum: SPRINT_SIZE_OPTIONS })
  @IsIn(SPRINT_SIZE_OPTIONS)
  totalQuestions: number;

  @ApiProperty({ enum: SPRINT_SIZE_OPTIONS })
  @IsIn(SPRINT_SIZE_OPTIONS)
  durationInMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marksPerQuestion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  negativeMarking?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showResultsImmediately?: boolean;
}
