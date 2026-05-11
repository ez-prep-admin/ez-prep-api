import { Expose, Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the tag',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'Speed Math',
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Tag description',
    example: 'Fast calculation techniques for competitive exams',
  })
  @Expose()
  description?: string;

  @ApiProperty({
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  subject: string;

  @ApiProperty({
    description: 'Topic ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  topic: string;

  @ApiProperty({
    description: 'Whether the tag is active',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Date when the tag was created',
    example: '2026-02-15T10:30:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the tag was last updated',
    example: '2026-02-15T10:35:00.000Z',
  })
  @Expose()
  updatedAt: Date;

  @Exclude()
  isDeleted: boolean;

  constructor(partial: Partial<TagResponseDto>) {
    Object.assign(this, partial);
  }
}
