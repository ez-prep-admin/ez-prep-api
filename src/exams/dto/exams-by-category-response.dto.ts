import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExamsByCategoryItemDto {
  @ApiProperty({
    description: 'Exam ID',
    example: '64f123456789abcdef123456',
  })
  id: string;

  @ApiProperty({
    description: 'Exam name/title',
    example: 'SBI PO',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Full name/description',
    example: 'State Bank of India Probationary Officer',
  })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Total duration',
    example: '3h',
  })
  duration?: string;

  @ApiPropertyOptional({
    description: 'Total questions',
    example: 100,
  })
  totalQuestions?: number;

  @ApiPropertyOptional({
    description: 'Total marks',
    example: 200,
  })
  totalMarks?: number;

  @ApiPropertyOptional({
    description: 'Mock tests available count',
    example: 45,
  })
  testsCount?: number;

  @ApiPropertyOptional({
    description: 'Number of subjects',
    example: 4,
  })
  subjectsCount?: number;
}

export class CategoryGroupDto {
  @ApiProperty({
    description: 'Category ID',
    example: '64f123456789abcdef123456',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Staff Selection Commission',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Category short name',
    example: 'SSC',
  })
  shortName: string;

  @ApiPropertyOptional({
    description: 'Category image URL',
    example: 'https://example.com/ssc.png',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Government recruitment for various posts',
  })
  description?: string;

  @ApiProperty({
    description: 'List of exams under this category',
    type: [ExamsByCategoryItemDto],
  })
  exams: ExamsByCategoryItemDto[];
}

// Response type: Record with category shortName as keys
export type ExamsByCategoryResponseDto = Record<string, CategoryGroupDto>;
