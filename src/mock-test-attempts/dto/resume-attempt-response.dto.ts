import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptTestMetadataDto } from './start-attempt-response.dto';
import { AttemptSessionDto } from './attempt-session.dto';

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

  @ApiPropertyOptional({
    description:
      'Session-wise only: which session this question belongs to (sessions[].order)',
    example: 0,
  })
  sessionOrder?: number;

  @ApiProperty({
    description: 'Selected option ID (if user has answered this question)',
    nullable: true,
  })
  selectedOption?: string | null;
}

export class ResumeAttemptResponseDto {
  @ApiProperty({ description: 'Attempt ID' })
  attemptId: string;

  @ApiProperty({
    description: 'Mock test metadata with exam, subject, and topic details',
    type: AttemptTestMetadataDto,
  })
  mockTestData: AttemptTestMetadataDto;

  @ApiProperty({
    description:
      'Questions with options and selected answers (NO correct answers or explanations)',
    type: [ResumeQuestionDto],
  })
  questions: ResumeQuestionDto[];

  @ApiProperty({
    description:
      'Seconds elapsed on the paper timer, or on the current session if session-wise',
  })
  timeElapsed: number;

  @ApiProperty({
    description:
      'Seconds remaining on the paper timer, or on the current session if session-wise',
  })
  timeRemaining: number;

  @ApiProperty({ description: 'Number of times paused', required: false })
  pauseCount?: number;

  @ApiProperty({
    description: 'Total time consumed (for paused attempts)',
    required: false,
  })
  timeConsumed?: number;

  @ApiPropertyOptional({
    description:
      'Session blocks for session-wise full exams (omit for topic-wise / mixed)',
    type: [AttemptSessionDto],
  })
  sessions?: AttemptSessionDto[];

  @ApiPropertyOptional({
    description:
      'Index of the active session. Timer fields apply to this session when set.',
    example: 0,
  })
  currentSessionIndex?: number;
}
