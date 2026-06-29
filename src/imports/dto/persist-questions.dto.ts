import { ArrayMinSize, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PersistQuestionBodyDto {
  @ApiProperty({
    description:
      'Mongo-ready questions array from the enrich API. Each saved question is stamped with source PDF_UPLOAD when omitted.',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  @ArrayMinSize(1)
  questions: unknown[];

  @ApiPropertyOptional({
    description:
      'Ignored if present — accepted for enrich API response compatibility',
  })
  @IsOptional()
  errors?: unknown[];

  @ApiPropertyOptional({
    description:
      'Ignored if present — accepted for enrich API response compatibility',
  })
  @IsOptional()
  stats?: Record<string, unknown>;
}

export { PersistQuestionBodyDto as PersistQuestionsDto };
