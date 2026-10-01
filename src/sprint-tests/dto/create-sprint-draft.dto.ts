import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
  @ApiProperty({
    description:
      'Exam the questions must be tagged to. Inactive exams are rejected.',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  examId: string;

  @ApiProperty({
    enum: SPRINT_SIZE_OPTIONS,
    description:
      'How many of the newest exam-tagged questions to freeze on the draft',
    example: 10,
  })
  @IsIn(SPRINT_SIZE_OPTIONS)
  totalQuestions: number;

  @ApiProperty({
    enum: SPRINT_SIZE_OPTIONS,
    description:
      'Single paper timer in minutes. Independent of the question count.',
    example: 15,
  })
  @IsIn(SPRINT_SIZE_OPTIONS)
  durationInMinutes: number;

  @ApiPropertyOptional({
    description:
      'When set, these questions are frozen in this order instead of sampling the newest exam-tagged questions. Length must equal totalQuestions. Each id must be active, have a difficulty, have a subject, and be tagged to examId.',
    type: [String],
    example: ['64f123456789abcdef123456'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(10)
  @ArrayMaxSize(30)
  @IsMongoId({ each: true })
  questionIds?: string[];

  @ApiPropertyOptional({
    description:
      'Shown to students. Defaults to the exam name on publish if empty.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional description shown on the catalog',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Marks for every correct answer. Defaults to 1.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marksPerQuestion?: number;

  @ApiPropertyOptional({
    description:
      'Marks deducted for every wrong answer. Unanswered questions are not penalized. Defaults to 0.',
    example: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  negativeMarking?: number;

  @ApiPropertyOptional({
    description:
      'Absolute passing score. If omitted, a finished attempt is not marked passed.',
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    description:
      'Students may start another attempt after finishing one. Defaults to true.',
  })
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional({
    description:
      'Stored on the paper. Attempt start does not reorder questions or options from this flag.',
  })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional({
    description:
      'Include answer keys and explanations in the submit response. Defaults to true.',
  })
  @IsOptional()
  @IsBoolean()
  showResultsImmediately?: boolean;
}
