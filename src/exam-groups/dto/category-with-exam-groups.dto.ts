import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ExamGroupInCategoryDto {
  @ApiProperty({
    description: 'Unique identifier for the exam group',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Exam group name',
    example: 'CGL',
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Short name/acronym',
    example: 'CGL',
  })
  @Expose()
  shortName?: string;

  @ApiPropertyOptional({
    description: 'Exam group description',
    example: 'Combined Graduate Level Examination',
  })
  @Expose()
  description?: string;

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

  constructor(partial: Partial<ExamGroupInCategoryDto>) {
    Object.assign(this, partial);
  }
}

export class CategoryWithExamGroupsDto {
  @ApiProperty({
    description: 'Unique identifier for the category',
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

  @ApiProperty({
    description: 'List of exam groups under this category',
    type: [ExamGroupInCategoryDto],
    example: [
      {
        id: '64f123456789abcdef123457',
        name: 'CGL',
        shortName: 'CGL',
        isActive: true,
      },
      {
        id: '64f123456789abcdef123458',
        name: 'CHSL',
        shortName: 'CHSL',
        isActive: true,
      },
    ],
  })
  examGroups: ExamGroupInCategoryDto[];
}
