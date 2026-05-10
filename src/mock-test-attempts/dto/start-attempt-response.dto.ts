import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Simplified - only expose URL to frontend, not S3 internal details
export class QuestionTextLanguageDto {
  @ApiPropertyOptional({
    description: 'Question text',
    example: 'What is the powerhouse of the cell?',
  })
  text?: string | null;

  @ApiPropertyOptional({
    description: 'Question image URL (pre-signed S3 URL)',
    example:
      'https://ez-prep-images.s3.ap-south-1.amazonaws.com/questions/abc123.jpg?X-Amz-...',
  })
  imageUrl?: string | null;
}

export class QuestionTextDto {
  @ApiProperty({
    description: 'English question text',
    type: QuestionTextLanguageDto,
  })
  en: QuestionTextLanguageDto;

  @ApiProperty({
    description: 'Malayalam question text',
    type: QuestionTextLanguageDto,
  })
  ml: QuestionTextLanguageDto;
}

export class QuestionOptionDto {
  @ApiProperty({
    description: 'Option unique ID (UUID)',
    example: '3b23efba-3626-4606-bee3-9130247d1949',
  })
  id: string;

  @ApiProperty({
    description: 'Option type',
    enum: ['text', 'image'],
    example: 'text',
  })
  type: string;

  @ApiPropertyOptional({
    description: 'Option text in English',
    example: 'Mitochondria',
  })
  en?: string | null;

  @ApiPropertyOptional({
    description: 'Option text in Malayalam',
    example: null,
  })
  ml?: string | null;

  @ApiPropertyOptional({
    description: 'Option image URL (pre-signed S3 URL)',
    example:
      'https://ez-prep-images.s3.ap-south-1.amazonaws.com/options/xyz789.jpg?X-Amz-...',
  })
  imageUrl?: string | null;
}

export class SafeQuestionDto {
  @ApiProperty({
    description: 'Question ID',
    example: '64f123456789abcdef123456',
  })
  _id: string;

  @ApiProperty({
    description: 'Question text with language support',
    type: QuestionTextDto,
  })
  questionText: QuestionTextDto;

  @ApiPropertyOptional({
    description: 'Option type for this question',
    enum: ['text', 'image'],
    example: 'text',
  })
  optionType?: string;

  @ApiProperty({
    description: 'Array of options',
    type: [QuestionOptionDto],
  })
  options: QuestionOptionDto[];

  @ApiPropertyOptional({
    description: 'Subject reference',
    example: '64f123456789abcdef123456',
  })
  subject?: string;

  @ApiPropertyOptional({
    description: 'Topic reference',
    example: '64f123456789abcdef123456',
  })
  topic?: string;

  @ApiPropertyOptional({
    description: 'Difficulty level',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficultyLevel?: string;
}

export class AttemptTestMetadataDto {
  @ApiProperty({
    description: 'Mock test title',
    example: 'Daily Practice Test 1',
  })
  title: string;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 30,
  })
  durationInMinutes: number;

  @ApiProperty({
    description: 'Total number of questions',
    example: 30,
  })
  totalQuestions: number;

  @ApiProperty({
    description: 'When the attempt was started',
    example: '2026-02-15T10:00:00.000Z',
  })
  startedAt: Date;

  @ApiPropertyOptional({
    description: 'Marks per question',
    example: 4,
  })
  marksPerQuestion?: number;

  @ApiPropertyOptional({
    description: 'Negative marking per wrong answer',
    example: 1,
  })
  negativeMarking?: number;

  @ApiPropertyOptional({
    description: 'Passing score',
    example: 50,
  })
  passingScore?: number;
}

export class StartAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt ID',
    example: '64f123456789abcdef123456',
  })
  attemptId: string;

  @ApiProperty({
    description: 'Test metadata',
    type: AttemptTestMetadataDto,
  })
  test: AttemptTestMetadataDto;

  @ApiProperty({
    description: 'Array of questions without answers',
    type: [SafeQuestionDto],
  })
  questions: SafeQuestionDto[];
}
