import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { MatchedQuestion } from '../types/matched-question';

export class EnrichQuestionsDto {
  @ApiPropertyOptional({
    description:
      'Matched questions from parse-markdown. Omit when using enrich/:uploadId.',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  matchedQuestions?: MatchedQuestion[];

  @ApiPropertyOptional({
    description:
      'Subject ID (required for POST /imports/enrich; taken from upload for enrich/:uploadId)',
  })
  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @ApiPropertyOptional({
    description:
      'Topic ID (required for POST /imports/enrich; taken from upload for enrich/:uploadId)',
  })
  @IsOptional()
  @IsMongoId()
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Exam IDs (optional; taken from upload for enrich/:uploadId)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  examIds?: string[];

  @ApiPropertyOptional({
    description:
      'Use token-aware adaptive chunking (recommended for 25+ questions)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  adaptiveChunking?: boolean;

  @ApiPropertyOptional({
    description: 'Process chunks in parallel (faster but higher API load)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useParallel?: boolean;

  @ApiPropertyOptional({
    description: 'Max retry attempts per chunk on LLM failure',
    default: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxRetries?: number;

  @ApiPropertyOptional({
    description:
      'Re-download markdown and re-run structure detection + parsing (enrich/:uploadId only)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceReparse?: boolean;

  @ApiPropertyOptional({
    description:
      'Max concurrent LLM chunk requests when useParallel is true (avoids rate limits)',
    default: 2,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxConcurrentChunks?: number;
}

export class MatchedQuestionDto {
  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ description: 'Raw question markdown from the PDF parser' })
  question: string;

  @ApiPropertyOptional({ description: 'Raw solution markdown when available' })
  solution?: string;
}

export class RejectedQuestionDto {
  @ApiProperty({
    example: 3,
    description: 'Question number in the source paper',
  })
  number: number;

  @ApiProperty({
    enum: ['llm', 'zod', 'business', 'mapping', 'image'],
    description: 'Pipeline stage where validation failed',
  })
  stage: string;

  @ApiProperty({
    description: 'Human-readable failure reason for the admin UI',
    example:
      'Model output failed business validation: expected 4 options, got 3',
  })
  message: string;

  @ApiProperty({
    type: MatchedQuestionDto,
    description:
      'Original matched question block so the admin can fix and retry',
  })
  matchedQuestion: MatchedQuestionDto;

  @ApiPropertyOptional({
    description:
      'Partial LLM-mapped question payload when failure happened after LLM output',
    type: 'object',
    additionalProperties: true,
  })
  questionDraft?: Record<string, unknown>;
}

export class EnrichStatsDto {
  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 23 })
  success: number;

  @ApiProperty({ example: 2 })
  failed: number;

  @ApiPropertyOptional({ example: 84210 })
  durationMs?: number;
}

export class EnrichChunkInfoDto {
  @ApiProperty({ example: 0 })
  chunkIndex: number;

  @ApiProperty({ example: 10 })
  questionCount: number;

  @ApiProperty({ example: 12450 })
  estimatedTokens: number;

  @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5] })
  questionNumbers: number[];
}

export class EnrichChunkingDto {
  @ApiProperty({ example: true })
  adaptiveChunking: boolean;

  @ApiProperty({ example: 3 })
  chunkCount: number;

  @ApiProperty({ example: 38200 })
  totalTokens: number;

  @ApiProperty({ type: [EnrichChunkInfoDto] })
  chunks: EnrichChunkInfoDto[];
}

export class EnrichParseMetaDto {
  @ApiProperty({ example: true })
  fromCache: boolean;

  @ApiProperty({ example: 'adaptive' })
  parserName: string;

  @ApiProperty({ example: 25 })
  matchedCount: number;
}

export class EnrichQuestionsResponseDto {
  @ApiPropertyOptional({
    description: 'Upload ID when enrichment was run via enrich/:uploadId',
    example: '507f1f77bcf86cd799439015',
  })
  uploadId?: string;

  @ApiPropertyOptional({
    description:
      'Upload status after enrichment (enriched until questions are persisted)',
    enum: ['enriched'],
    example: 'enriched',
  })
  status?: string;

  @ApiProperty({
    description:
      'Mongo-ready questions that passed Zod schema validation and NEET business rules',
    type: 'array',
    items: { type: 'object' },
  })
  questions: unknown[];

  @ApiProperty({
    description:
      'Questions that failed enrichment with stage, reason, and source markdown for admin review',
    type: [RejectedQuestionDto],
  })
  rejected: RejectedQuestionDto[];

  @ApiProperty({ type: EnrichStatsDto })
  stats: EnrichStatsDto;

  @ApiProperty({
    description:
      'Human-readable enrichment outcome for admin toasts (e.g. success/failed counts)',
    example:
      'Enrichment complete: 23 of 25 question(s) passed and are ready to import. 2 failed — review and fix them separately before importing.',
  })
  summary: string;

  @ApiPropertyOptional({ type: EnrichChunkingDto })
  chunking?: EnrichChunkingDto;

  @ApiPropertyOptional({ type: EnrichParseMetaDto })
  parse?: EnrichParseMetaDto;
}
