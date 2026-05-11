import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchCategoryResultDto {
  @ApiProperty({
    description: 'Category ID',
    example: '64f123456789abcdef123456',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'SSC',
  })
  name: string;

  @ApiProperty({
    description: 'Short name/acronym',
    example: 'SSC',
  })
  shortName: string;

  @ApiPropertyOptional({
    description: 'Image URL',
    example: 'https://example.com/images/ssc.png',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Staff Selection Commission examinations',
  })
  description?: string;
}

export class SearchExamResultDto {
  @ApiProperty({
    description: 'Exam ID',
    example: '64f123456789abcdef123456',
  })
  id: string;

  @ApiProperty({
    description: 'Exam name',
    example: 'SSC CGL Tier 1',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Exam description',
    example: 'Combined Graduate Level Examination Tier 1',
  })
  description?: string;

  @ApiProperty({
    description: 'Category this exam belongs to',
    example: { id: '64f123456789abcdef123456', name: 'SSC', shortName: 'SSC' },
  })
  category: { id: string; name: string; shortName: string };

  @ApiProperty({
    description: 'Exam group this exam belongs to',
    example: { id: '64f123456789abcdef123457', name: 'CGL', shortName: 'CGL' },
  })
  examGroup: { id: string; name: string; shortName?: string };

  @ApiPropertyOptional({
    description: 'Duration in minutes',
    example: 60,
  })
  duration?: number;

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
}

export class SearchResultsDto {
  @ApiProperty({
    description: 'Matching categories',
    type: [SearchCategoryResultDto],
  })
  categories: SearchCategoryResultDto[];

  @ApiProperty({
    description: 'Matching exams',
    type: [SearchExamResultDto],
  })
  exams: SearchExamResultDto[];
}

export class SearchMetaDto {
  @ApiProperty({
    description: 'The search query string',
    example: 'SSC',
  })
  query: string;

  @ApiProperty({
    description: 'Total number of matching categories',
    example: 1,
  })
  categoriesCount: number;

  @ApiProperty({
    description: 'Total number of matching exams',
    example: 5,
  })
  examsCount: number;
}
