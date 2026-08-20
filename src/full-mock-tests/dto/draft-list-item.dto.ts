import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DraftListItemDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  id: string;

  @ApiProperty({ example: '64f123456789abcdef123456' })
  examId: string;

  @ApiProperty({
    description: 'Exam name from the frozen blueprint snapshot',
    example: 'SSC CGL TIER 1',
  })
  examName: string;

  @ApiProperty({
    description:
      'Only open drafts are listed (REVIEW / GENERATING / PUBLISHING)',
    enum: ['GENERATING', 'REVIEW', 'PUBLISHING'],
    example: 'REVIEW',
  })
  status: string;

  @ApiProperty({ example: 100 })
  totalQuestions: number;

  @ApiPropertyOptional({ example: 200 })
  totalMarks?: number;

  @ApiPropertyOptional({
    description:
      'Mixed: exam duration. Session-wise: may be unset on snapshot.',
    example: 60,
  })
  duration?: number;

  @ApiProperty({ example: false })
  isSessionWise: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
