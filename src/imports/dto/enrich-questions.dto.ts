import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class EnrichQuestionsResponseDto {
  questions: unknown[];
  errors: Array<{ number: number; stage: string; message: string }>;
  stats: {
    total: number;
    success: number;
    failed: number;
  };
  chunking?: {
    chunkCount: number;
    totalTokens: number;
    avgQuestionsPerChunk: number;
    avgTokensPerChunk: number;
  };
}
