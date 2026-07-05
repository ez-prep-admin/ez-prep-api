import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrichStatsDto, MatchedQuestionDto } from './enrich-questions.dto';

export class PersistQuestionErrorDto {
  @ApiProperty({ example: 0 })
  index: number;

  @ApiProperty({ example: 'Question at index 0 failed validation.' })
  message: string;
}

export class PersistedQuestionRefDto {
  @ApiProperty({ example: 0 })
  index: number;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  questionId: string;
}

export class PersistStatsDto {
  @ApiProperty({ example: 23 })
  total: number;

  @ApiProperty({ example: 23 })
  saved: number;

  @ApiProperty({ example: 0 })
  failed: number;
}

export class PersistQuestionsResponseDto {
  @ApiProperty({
    description: 'Upload ID whose cached questions were imported',
    example: '507f1f77bcf86cd799439015',
  })
  uploadId: string;

  @ApiPropertyOptional({
    description:
      'Upload status after import (`completed` when all cached questions saved)',
    enum: ['enriched', 'completed'],
    example: 'completed',
  })
  uploadStatus?: string;

  @ApiProperty({
    description: 'Human-readable import outcome for admin toasts',
    example:
      'Import complete: 23 question(s) saved to the database. Upload marked as completed.',
  })
  summary: string;

  @ApiProperty({ type: [PersistedQuestionRefDto] })
  saved: PersistedQuestionRefDto[];

  @ApiProperty({ type: [PersistQuestionErrorDto] })
  errors: PersistQuestionErrorDto[];

  @ApiProperty({ type: PersistStatsDto })
  stats: PersistStatsDto;
}

export class ImportFailedQuestionDto {
  @ApiProperty({
    description: 'Corrected Mongo-ready question payload from the admin UI',
    type: 'object',
    additionalProperties: true,
  })
  question: Record<string, unknown>;
}

export class FailedQuestionListItemDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439020' })
  id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439015' })
  uploadId: string;

  @ApiProperty({ example: 3 })
  questionNumber: number;

  @ApiProperty({ enum: ['llm', 'zod', 'business', 'mapping', 'image'] })
  failureStage: string;

  @ApiProperty()
  failureMessage: string;

  @ApiProperty({ type: MatchedQuestionDto })
  matchedQuestion: MatchedQuestionDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  questionDraft?: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CachedEnrichmentResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439015' })
  uploadId: string;

  @ApiProperty({
    description: 'Current upload status',
    enum: [
      'uploaded',
      'parsing',
      'parsed',
      'processing',
      'enriched',
      'completed',
      'failed',
    ],
  })
  status: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  questions: unknown[];

  @ApiProperty({ type: [FailedQuestionListItemDto] })
  rejected: FailedQuestionListItemDto[];

  @ApiProperty({ type: EnrichStatsDto })
  stats: EnrichStatsDto;

  @ApiPropertyOptional()
  enrichedAt?: Date;
}
