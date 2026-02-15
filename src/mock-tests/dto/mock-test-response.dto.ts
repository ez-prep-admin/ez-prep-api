import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MockTestResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the mock test',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Title of the mock test',
    example: 'NEET 2025 Full Length Mock Test 1',
  })
  @Expose()
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the mock test',
    example: 'Comprehensive NEET mock test covering all subjects',
  })
  @Expose()
  description?: string;

  @ApiProperty({
    description: 'Total number of questions in the mock test',
    example: 180,
  })
  @Expose()
  totalQuestions: number;

  @ApiProperty({
    description: 'Duration of the test in minutes',
    example: 180,
  })
  @Expose()
  durationInMinutes: number;

  @ApiProperty({
    description: 'Array of subject IDs',
    example: ['64f123456789abcdef123456', '64f123456789abcdef123457'],
  })
  @Expose()
  subjects: string[];

  @ApiProperty({
    description: 'Test generation mode',
    enum: ['STATIC', 'DYNAMIC'],
    example: 'STATIC',
  })
  @Expose()
  generationMode: string;

  @ApiProperty({
    description: 'Array of question IDs for static tests',
    example: ['64f123456789abcdef123456', '64f123456789abcdef123457'],
  })
  @Expose()
  questionIds: string[];

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

  @ApiPropertyOptional({
    description: 'Difficulty level of the mock test',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  @Expose()
  difficultyLevel?: string;

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

  // Exclude sensitive fields from response
  @Exclude()
  isDeleted: boolean;

  constructor(partial: Partial<MockTestResponseDto>) {
    Object.assign(this, partial);
  }
}
