import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';

export class ExamSubjectResponseDto {
  @ApiProperty({ description: 'Subject ID', example: '64f123...' })
  @Expose()
  subject: string;

  @ApiProperty({ description: 'Number of questions', example: 25 })
  @Expose()
  numberOfQuestions: number;

  @ApiProperty({ description: 'Marks per question', example: 2 })
  @Expose()
  marksPerQuestion: number;

  @ApiProperty({ description: 'Has negative marking', example: true })
  @Expose()
  hasNegativeMarking: boolean;

  @ApiProperty({ description: 'Negative marks per question', example: 0.5 })
  @Expose()
  negativeMarksPerQuestion: number;

  @ApiPropertyOptional({ description: 'Session time in minutes', example: 60 })
  @Expose()
  sessionTime?: number;
}

export class ExamResponseDto {
  @ApiProperty({
    description: 'Exam ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Exam name',
    example: 'SBI PO',
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Exam description',
    example: 'State Bank of India Probationary Officer',
  })
  @Expose()
  description?: string;

  @ApiProperty({
    description: 'Category ID or populated category',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  category: string | CategoryResponseDto;

  @ApiPropertyOptional({
    description: 'Duration in minutes',
    example: 180,
  })
  @Expose()
  duration?: number;

  @ApiPropertyOptional({
    description: 'Total questions',
    example: 100,
  })
  @Expose()
  totalQuestions?: number;

  @ApiPropertyOptional({
    description: 'Total marks',
    example: 200,
  })
  @Expose()
  totalMarks?: number;

  @ApiPropertyOptional({
    description: 'Subject-wise configuration',
    type: [ExamSubjectResponseDto],
  })
  @Expose()
  @Type(() => ExamSubjectResponseDto)
  subjects?: ExamSubjectResponseDto[];

  @ApiProperty({
    description: 'Session-wise exam flag',
    example: false,
  })
  @Expose()
  isSessionWise: boolean;

  @ApiProperty({
    description: 'Active status',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-05-10T10:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-05-10T10:00:00.000Z',
  })
  @Expose()
  updatedAt: Date;

  @Exclude()
  isDeleted: boolean;

  constructor(partial: Partial<ExamResponseDto>) {
    Object.assign(this, partial);
  }
}
