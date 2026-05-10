import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
  Min,
  IsMongoId,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExamSubjectDto {
  @ApiProperty({
    description: 'Subject ID reference',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  subject: string;

  @ApiProperty({
    description: 'Number of questions for this subject',
    example: 25,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  numberOfQuestions: number;

  @ApiProperty({
    description: 'Marks per question',
    example: 2,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  marksPerQuestion: number;

  @ApiProperty({
    description: 'Whether negative marking is applicable',
    example: true,
  })
  @IsBoolean()
  hasNegativeMarking: boolean;

  @ApiProperty({
    description: 'Negative marks per wrong answer',
    example: 0.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  negativeMarksPerQuestion: number;

  @ApiPropertyOptional({
    description: 'Session time in minutes (if session-wise)',
    example: 60,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionTime?: number;
}

export class CreateExamDto {
  @ApiProperty({
    description: 'Exam name',
    example: 'SBI PO',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Exam description',
    example: 'State Bank of India Probationary Officer Exam',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Category ID (e.g., Banking, SSC)',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  category: string;

  @ApiPropertyOptional({
    description: 'Total duration in minutes',
    example: 180,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Total number of questions',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuestions?: number;

  @ApiPropertyOptional({
    description: 'Total marks',
    example: 200,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalMarks?: number;

  @ApiPropertyOptional({
    description: 'Subject-wise configuration',
    type: [ExamSubjectDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamSubjectDto)
  subjects?: ExamSubjectDto[];

  @ApiPropertyOptional({
    description: 'Whether exam is divided into sessions',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isSessionWise?: boolean;
}
