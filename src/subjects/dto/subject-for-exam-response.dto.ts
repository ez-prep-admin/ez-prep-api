import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SubjectForExamResponseDto {
  @ApiProperty({
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Subject name',
    example: 'Quantitative Aptitude',
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Subject description',
    example: 'Mathematics and problem solving',
  })
  @Expose()
  description?: string;

  constructor(partial: Partial<SubjectForExamResponseDto>) {
    Object.assign(this, partial);
  }
}
