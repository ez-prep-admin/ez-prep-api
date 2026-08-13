import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DraftQuestionItemDto } from './draft-question-item.dto';

export class DraftSubjectBlockDto {
  @ApiProperty({
    description: 'Subject ID for this block',
    example: '64f123456789abcdef123456',
  })
  subjectId: string;

  @ApiProperty({
    description: 'Subject display name',
    example: 'Quantitative Aptitude',
  })
  name: string;

  @ApiProperty({
    description:
      'How many questions this subject must have (from exam blueprint)',
    example: 25,
  })
  numberOfQuestions: number;

  @ApiProperty({
    description: 'Marks per correct answer for this subject',
    example: 2,
  })
  marksPerQuestion: number;

  @ApiProperty({
    description: 'Whether wrong answers deduct marks in this subject',
    example: true,
  })
  hasNegativeMarking: boolean;

  @ApiProperty({
    description: 'Deduction per wrong answer when hasNegativeMarking is true',
    example: 0.5,
  })
  negativeMarksPerQuestion: number;

  @ApiPropertyOptional({
    description: 'Session timer in minutes (session-wise exams only)',
    example: 60,
  })
  sessionTime?: number;

  @ApiProperty({
    description:
      'Safe questions for this subject (no correctAnswer / explanation). Order is topic groups within the subject.',
    type: [DraftQuestionItemDto],
  })
  questions: DraftQuestionItemDto[];
}

export class DraftExamSnapshotDto {
  @ApiProperty({ example: 'SSC CGL TIER 1' })
  name: string;

  @ApiPropertyOptional({ example: 'Combined Graduate Level Tier 1' })
  description?: string;

  @ApiPropertyOptional({
    description:
      'Paper duration in minutes (mixed exams). Stored as metadata for session-wise too.',
    example: 60,
  })
  duration?: number;

  @ApiProperty({
    description: 'Must equal the sum of subject quotas',
    example: 100,
  })
  totalQuestions: number;

  @ApiPropertyOptional({
    description:
      'Must equal sum(numberOfQuestions * marksPerQuestion) when set on the exam',
    example: 200,
  })
  totalMarks?: number;

  @ApiProperty({
    description: 'true = one timer per subject; false = one paper timer',
    example: false,
  })
  isSessionWise: boolean;
}

export class DraftResponseDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  id: string;

  @ApiProperty({ example: '64f123456789abcdef123456' })
  examId: string;

  @ApiProperty({
    description:
      'REVIEW = editable. PUBLISHED = already written to mocktests. DISCARDED = soft-deleted.',
    enum: ['GENERATING', 'REVIEW', 'PUBLISHED', 'DISCARDED'],
    example: 'REVIEW',
  })
  status: string;

  @ApiProperty({
    description:
      'Frozen copy of the exam blueprint used to generate this paper',
    type: DraftExamSnapshotDto,
  })
  examSnapshot: DraftExamSnapshotDto;

  @ApiProperty({
    description: 'Questions grouped by subject in exam.subjects[] order',
    type: [DraftSubjectBlockDto],
  })
  subjects: DraftSubjectBlockDto[];

  @ApiPropertyOptional({
    description: 'Set after publish — the FULL_EXAM mock test ID',
    example: '64f123456789abcdef123456',
  })
  publishedMockTestId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
