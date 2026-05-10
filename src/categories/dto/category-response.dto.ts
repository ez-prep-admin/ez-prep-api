import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the category',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Banking',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Short name/acronym',
    example: 'BANK',
  })
  @Expose()
  shortName: string;

  @ApiPropertyOptional({
    description: 'Image URL',
    example: 'https://example.com/images/banking.png',
  })
  @Expose()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Competitive exams for banking sector jobs',
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

  @Exclude()
  isDeleted: boolean;

  constructor(partial: Partial<CategoryResponseDto>) {
    Object.assign(this, partial);
  }
}
