import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopicResponseDto {
  @ApiProperty({
    description: 'Topic ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Topic name',
    example: 'Ratio & Proportion',
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Topic description',
    example: 'Learn about ratios and proportions',
  })
  @Expose()
  description?: string;

  @ApiProperty({
    description: 'Whether the topic is active',
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

  constructor(partial: Partial<TopicResponseDto>) {
    Object.assign(this, partial);
  }
}
