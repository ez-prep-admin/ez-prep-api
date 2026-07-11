import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { EnrichStatsDto, MatchedQuestionDto } from './enrich-questions.dto';
import {
  DeleteFailedQuestionResponseDto,
  ImportFailedQuestionResponseDto,
  ImportQuestionPayloadDto,
} from './import-question.dto';

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
  @ValidateNested()
  @Type(() => ImportQuestionPayloadDto)
  @ApiProperty({
    description:
      'Corrected Mongo-ready question payload from the admin UI. ' +
      'Must pass the same validation as bulk import (Zod schema, 4 NEET options, ' +
      'difficultyLevel, subject/topic/exam references, correctAnswer matching an option id). ' +
      'The failed question id is taken from the URL path; on success that failed_questions entry is deleted.',
    type: ImportQuestionPayloadDto,
  })
  question: ImportQuestionPayloadDto;
}

export { ImportFailedQuestionResponseDto, DeleteFailedQuestionResponseDto };

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

  @ApiPropertyOptional({
    type: ImportQuestionPayloadDto,
    description:
      'Partial LLM-mapped payload stored at enrichment time when failure happened after LLM output',
  })
  questionDraft?: ImportQuestionPayloadDto;

  @ApiProperty({
    type: ImportQuestionPayloadDto,
    description:
      'Form-ready question payload for the admin edit UI. Uses questionDraft when available, ' +
      'otherwise a shell built from upload metadata (subject, topic, exams) and source markdown.',
  })
  question: ImportQuestionPayloadDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FailedQuestionsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class FailedQuestionsListResponseDto {
  @ApiProperty({ type: [FailedQuestionListItemDto] })
  items: FailedQuestionListItemDto[];

  @ApiProperty({ type: FailedQuestionsPaginationDto })
  pagination: FailedQuestionsPaginationDto;
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
