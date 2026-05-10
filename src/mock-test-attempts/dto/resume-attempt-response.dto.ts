import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ description: 'MongoDB ID' })
  _id: string;
}

class QuestionTextDto {
  @ApiProperty({ description: 'Question text', nullable: true })
  text: string | null;

  @ApiProperty({ description: 'Question image URL', nullable: true })
  image: string | null;
}

class ResumeQuestionDto {
  @ApiProperty({ description: 'Question ID' })
  _id: string;

  @ApiProperty({ description: 'Localized question text' })
  questionText: Record<string, QuestionTextDto>;

  @ApiProperty({ description: 'Answer options', type: [QuestionOptionDto] })
  options: QuestionOptionDto[];

  @ApiProperty({ description: 'Subject ID' })
  subject: string;

  @ApiProperty({
    description: 'Selected option ID (if user has answered this question)',
    nullable: true,
  })
  selectedOption?: string | null;
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
}

export class ResumeAttemptResponseDto {
  @ApiProperty({ description: 'Attempt ID' })
  attemptId: string;

  @ApiProperty({ description: 'Test metadata (frozen configuration)' })
  test: TestMetadataDto;

  @ApiProperty({
    description:
      'Questions with options and selected answers (NO correct answers or explanations)',
    type: [ResumeQuestionDto],
  })
  questions: ResumeQuestionDto[];

  @ApiProperty({ description: 'Time elapsed in seconds' })
  timeElapsed: number;

  @ApiProperty({ description: 'Time remaining in seconds' })
  timeRemaining: number;

  @ApiProperty({ description: 'Number of times paused', required: false })
  pauseCount?: number;

  @ApiProperty({
    description: 'Total time consumed (for paused attempts)',
    required: false,
  })
  timeConsumed?: number;
}
