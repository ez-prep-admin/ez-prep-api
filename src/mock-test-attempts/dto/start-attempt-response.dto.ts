import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  en: string | null;

  @ApiPropertyOptional({
    description: 'Option text in Malayalam',
    example: null,
  })
  ml: string | null;

  @ApiPropertyOptional({
    description: 'Option image URL',
    example: null,
  })
  url?: string | null;

  @ApiPropertyOptional({
    description: 'MongoDB ObjectId',
    example: '67c5f71b2548058025b23458',
  })
  _id?: string;
}

export class SafeQuestionDto {
  @ApiProperty({
    description: 'Question ID',
    example: '64f123456789abcdef123456',
  })
  _id: string;

  @ApiProperty({
    description: 'Question text (localized with text and image per language)',
    example: {
      en: { text: 'What is the powerhouse of the cell?', image: null },
      ml: { text: null, image: null },
    },
  })
  questionText: Record<string, { text: string | null; image: string | null }>;

  @ApiPropertyOptional({
    description: 'Question image URL',
    example: null,
  })
  image?: string | null;

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
    description: 'Difficulty level',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty?: string;
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
