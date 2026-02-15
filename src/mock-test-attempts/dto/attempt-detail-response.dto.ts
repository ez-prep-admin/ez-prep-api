import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class QuestionOptionDto {
  @ApiProperty({ description: 'Option ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Option type (text/image)' })
  type: string;

  @ApiProperty({ description: 'Option text in English', nullable: true })
  en: string | null;

  @ApiProperty({ description: 'Option text in Malayalam', nullable: true })
  ml: string | null;

  @ApiProperty({ description: 'Option image URL', nullable: true })
  url: string | null;
}

class QuestionTextDto {
  @ApiProperty({ description: 'Question text', nullable: true })
  text: string | null;

  @ApiProperty({ description: 'Question image URL', nullable: true })
  image: string | null;
}

class AttemptQuestionDto {
  @ApiProperty({ description: 'Question ID' })
  _id: string;

  @ApiProperty({ description: 'Localized question text' })
  questionText: Record<string, QuestionTextDto>;

  @ApiProperty({ description: 'Answer options', type: [QuestionOptionDto] })
  options: QuestionOptionDto[];

  @ApiProperty({ description: 'Subject ID' })
  subject: string;

  @ApiPropertyOptional({
    description: 'Selected option ID (only for IN_PROGRESS attempts)',
  })
  selectedOption?: string | null;

  @ApiPropertyOptional({
    description: 'Correct answer (only shown after submission if allowed)',
  })
  correctAnswer?: string;

  @ApiPropertyOptional({
    description: 'Whether answer was correct (only after submission)',
  })
  isCorrect?: boolean;

  @ApiPropertyOptional({
    description: 'Marks awarded for this question (only after submission)',
  })
  marksAwarded?: number;

  @ApiPropertyOptional({
    description: 'Explanation (only shown after submission if allowed)',
  })
  explanation?: Record<string, string>;
}

class TestMetadataDto {
  @ApiProperty({ description: 'Mock test title' })
  title: string;

  @ApiProperty({ description: 'Test duration in minutes' })
  durationInMinutes: number;

  @ApiProperty({ description: 'Total number of questions' })
  totalQuestions: number;

  @ApiProperty({ description: 'When the attempt started' })
  startedAt: Date;

  @ApiProperty({ description: 'Marks per correct answer' })
  marksPerQuestion: number;

  @ApiProperty({ description: 'Negative marking per wrong answer' })
  negativeMarking: number;

  @ApiProperty({ description: 'Minimum score to pass', nullable: true })
  passingScore: number | null;

  @ApiPropertyOptional({
    description: 'Whether results are shown immediately after submission',
  })
  showResultsImmediately?: boolean;
}

export class AttemptDetailResponseDto {
  @ApiProperty({ description: 'Attempt ID' })
  attemptId: string;

  @ApiProperty({ description: 'Attempt status' })
  status: string;

  @ApiProperty({ description: 'Test metadata (frozen configuration)' })
  test: TestMetadataDto;

  @ApiProperty({
    description: 'Questions with options and selected answers',
    type: [AttemptQuestionDto],
  })
  questions: AttemptQuestionDto[];

  @ApiPropertyOptional({ description: 'Time elapsed in seconds' })
  timeElapsed?: number;

  @ApiPropertyOptional({ description: 'Time remaining in seconds' })
  timeRemaining?: number;

  @ApiPropertyOptional({
    description: 'Final score (only for submitted attempts)',
  })
  score?: number;

  @ApiPropertyOptional({
    description: 'When submitted (only for submitted attempts)',
  })
  submittedAt?: Date;

  @ApiPropertyOptional({
    description: 'Correct answers count (only for submitted attempts)',
  })
  correctAnswers?: number;

  @ApiPropertyOptional({
    description: 'Incorrect answers count (only for submitted attempts)',
  })
  incorrectAnswers?: number;

  @ApiPropertyOptional({
    description: 'Unanswered questions count (only for submitted attempts)',
  })
  unansweredQuestions?: number;

  @ApiPropertyOptional({
    description: 'Whether passed (only for submitted attempts)',
  })
  isPassed?: boolean;
}
