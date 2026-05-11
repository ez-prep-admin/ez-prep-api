import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';

export class ExamGroupResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the exam group',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Exam group name',
    example: 'UPSC CSE',
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Short name/acronym',
    example: 'CSE',
  })
  @Expose()
  shortName?: string;

  @ApiProperty({
    description: 'Category ID or populated category',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  category: string | CategoryResponseDto;

  @ApiPropertyOptional({
    description: 'Exam group description',
    example: 'Union Public Service Commission Civil Services Examination',
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

  constructor(partial: Partial<ExamGroupResponseDto>) {
    Object.assign(this, partial);
  }
}
