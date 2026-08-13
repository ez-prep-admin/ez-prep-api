import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FullMockExamListItemDto {
  @ApiProperty({
    description: 'Exam ID to send to POST /full-mock-tests/drafts',
    example: '64f123456789abcdef123456',
  })
  id: string;

  @ApiProperty({
    description: 'Exam name',
    example: 'SSC CGL TIER 2',
  })
  examName: string;

  @ApiPropertyOptional({
    description: 'Formatted duration from exam.duration',
    example: '135 mins',
  })
  duration?: string;

  @ApiPropertyOptional({
    description: 'exam.totalQuestions (official paper size)',
    example: 130,
  })
  questions?: number;

  @ApiPropertyOptional({
    description: 'exam.totalMarks',
    example: 390,
  })
  totalMarks?: number;

  @ApiPropertyOptional({
    description: 'Populated category name',
    example: 'Staff Selection Commission (SSC)',
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'Populated exam-group name. May be absent if none is set.',
    example: 'Combined Graduate Level',
  })
  examGroup?: string;

  @ApiProperty({
    description:
      'Subject names in exam.subjects[] order (for the admin table Subjects column)',
    example: [
      'QUANTITATIVE APTITUDE',
      'GENERAL INTELLIGENCE AND REASONING',
      'ENGLISH',
      'GENERAL AWARENESS',
    ],
    type: [String],
  })
  subjects: string[];

  @ApiProperty({
    description: 'Derived from exam.isSessionWise',
    enum: ['Mixed', 'Session-wise'],
    example: 'Session-wise',
  })
  mode: 'Mixed' | 'Session-wise';
}
