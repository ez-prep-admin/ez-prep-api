import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionResultDto {
  @ApiProperty({
    description: 'Question ID',
    example: '67c5f4ee4d671dbf0cb95a12',
  })
  questionId: string;

  @ApiPropertyOptional({
    description: 'Selected option ID',
    example: 'fe99dedc-7c4b-445a-9c5f-03e5706bf184',
  })
  selectedOption: string | null;

  @ApiProperty({
    description: 'Correct answer ID',
    example: 'fe99dedc-7c4b-445a-9c5f-03e5706bf184',
  })
  correctAnswer: string;

  @ApiProperty({
    description: 'Whether the answer was correct',
    example: true,
  })
  isCorrect: boolean;

  @ApiProperty({
    description: 'Marks awarded for this question',
    example: 4,
  })
  marksAwarded: number;

  @ApiPropertyOptional({
    description: 'Explanation (localized)',
    example: { en: 'The correct answer is...', ml: null },
  })
  explanation?: Record<string, string>;
}

export class SubmitAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt ID',
    example: '64f123456789abcdef123456',
  })
  attemptId: string;

  @ApiProperty({
    description: 'Final score',
    example: 85,
  })
  score: number;

  @ApiProperty({
    description: 'Total possible score',
    example: 100,
  })
  totalScore: number;

  @ApiPropertyOptional({
    description: 'Passing score',
    example: 50,
  })
  passingScore?: number;

  @ApiProperty({
    description: 'Whether the user passed the test',
    example: true,
  })
  passed: boolean;

  @ApiProperty({
    description: 'Number of correct answers',
    example: 22,
  })
  correctAnswers: number;

  @ApiProperty({
    description: 'Number of incorrect answers',
    example: 5,
  })
  incorrectAnswers: number;

  @ApiProperty({
    description: 'Number of unanswered questions',
    example: 3,
  })
  unansweredQuestions: number;

  @ApiProperty({
    description: 'When the attempt was submitted',
    example: '2026-02-15T10:30:00.000Z',
  })
  submittedAt: Date;

  @ApiProperty({
    description: 'Time taken in seconds',
    example: 1500,
  })
  timeTaken: number;

  @ApiPropertyOptional({
    description:
      'Detailed results per question (only if showResultsImmediately is true)',
    type: [QuestionResultDto],
  })
  questionResults?: QuestionResultDto[];
}
