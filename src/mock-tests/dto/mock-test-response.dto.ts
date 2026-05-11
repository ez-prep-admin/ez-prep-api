import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserAttemptAction } from '../../common/enums/user-attempt-action.enum';

export class DifficultyDistributionDto {
  @ApiProperty({
    description: 'Number of easy questions',
    example: 10,
  })
  @Expose()
  easy: number;

  @ApiProperty({
    description: 'Number of medium questions',
    example: 15,
  })
  @Expose()
  medium: number;

  @ApiProperty({
    description: 'Number of hard questions',
    example: 5,
  })
  @Expose()
  hard: number;
}

export class MockTestResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the mock test',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Total number of questions in the mock test',
    enum: [10, 15, 20, 25, 30],
    example: 30,
  })
  @Expose()
  totalQuestions: number;

  @ApiProperty({
    description: 'Duration of the test in minutes',
    enum: [10, 15, 20, 25, 30],
    example: 30,
  })
  @Expose()
  durationInMinutes: number;

  @ApiProperty({
    description: 'Exam reference ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  exam: string;

  @ApiProperty({
    description: 'Subject reference ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  subject: string;

  @ApiPropertyOptional({
    description: 'Topic reference ID (optional)',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Title of the mock test',
    example: 'NEET 2025 Full Length Mock Test 1',
  })
  @Expose()
  title?: string;

  @ApiPropertyOptional({
    description: 'Description of the mock test',
    example: 'Comprehensive NEET mock test covering all subjects',
  })
  @Expose()
  description?: string;

  @ApiProperty({
    description: 'Test generation mode',
    enum: ['STATIC', 'DYNAMIC'],
    example: 'STATIC',
  })
  @Expose()
  generationMode: string;

  @ApiProperty({
    description: 'Marks awarded per correct answer',
    example: 4,
  })
  @Expose()
  marksPerQuestion: number;

  @ApiProperty({
    description: 'Negative marks for incorrect answer',
    example: 1,
  })
  @Expose()
  negativeMarking: number;

  @ApiPropertyOptional({
    description: 'Minimum score required to pass',
    example: 360,
  })
  @Expose()
  passingScore?: number;

  @ApiProperty({
    description: 'Whether users can retake the test',
    example: true,
  })
  @Expose()
  allowRetake: boolean;

  @ApiProperty({
    description: 'Whether options should be shuffled',
    example: false,
  })
  @Expose()
  shuffleOptions: boolean;

  @ApiProperty({
    description: 'Whether results are shown immediately after completion',
    example: true,
  })
  @Expose()
  showResultsImmediately: boolean;

  @ApiProperty({
    description: 'Whether the mock test is currently active',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'User ID who created the mock test',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  createdBy?: string;

  @ApiProperty({
    description: 'Difficulty distribution of questions',
    type: DifficultyDistributionDto,
  })
  @Expose()
  @Type(() => DifficultyDistributionDto)
  difficultyDistribution: DifficultyDistributionDto;

  @ApiProperty({
    description: 'Date when the mock test was created',
    example: '2026-02-15T10:30:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the mock test was last updated',
    example: '2026-02-15T10:35:00.000Z',
  })
  @Expose()
  updatedAt: Date;

  @ApiProperty({
    description: 'Recommended action for the user based on attempt history',
    enum: UserAttemptAction,
    example: UserAttemptAction.START,
  })
  @Expose()
  userAttemptAction: UserAttemptAction;

  // Exclude sensitive fields from response
  @Exclude()
  questionIds: string[];

  @Exclude()
  isDeleted: boolean;

  constructor(partial: Partial<MockTestResponseDto>) {
    Object.assign(this, partial);
  }
}
