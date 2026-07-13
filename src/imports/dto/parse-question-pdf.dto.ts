import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  UPLOAD_STATUSES,
  UploadStatus,
} from '../schemas/question-upload.schema';

/**
 * DTO for parsing a question paper PDF using Mathpix
 */
export class ParseQuestionPdfDto {
  @ApiPropertyOptional({
    description: 'Maximum polling attempts for Mathpix conversion',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  maxPollingAttempts?: number;

  @ApiPropertyOptional({
    description: 'Interval between polling attempts in milliseconds',
    example: 5000,
    default: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(30000)
  pollingIntervalMs?: number;
}

/**
 * Immediate response when a PDF parse job is accepted (async Mathpix pipeline).
 */
export class StartParsePdfUploadResponseDto {
  @ApiProperty({
    description: 'Upload ID for polling parse status',
    example: '507f1f77bcf86cd799439015',
  })
  uploadId: string;

  @ApiProperty({
    description:
      'Upload status while Mathpix conversion runs in the background',
    enum: ['parsing'],
    example: 'parsing',
  })
  status: 'parsing';

  @ApiProperty({
    description: 'Instructions for polling until parsing completes',
    example:
      'PDF parsing started. Poll GET /imports/uploads/:uploadId until status is parsed or failed.',
  })
  message: string;
}

/**
 * Response DTO for PDF parsing result
 */
export class ParseQuestionPdfResponseDto {
  @ApiProperty({
    description: 'Upload ID',
    example: '507f1f77bcf86cd799439015',
  })
  uploadId: string;

  @ApiProperty({
    description: 'Mathpix PDF ID',
    example: 'mp_abc123xyz789',
  })
  mathpixPdfId: string;

  @ApiProperty({
    description:
      'Markdown content extracted from PDF (returned in immediate response only, not stored in database for space efficiency)',
  })
  markdown: string;

  @ApiPropertyOptional({
    description:
      'S3 key where markdown is saved (use this to retrieve markdown in future requests)',
    example: 'question-uploads/markdowns/neet_2023_physics.md',
  })
  markdownS3Key?: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 45000,
  })
  processingTimeMs: number;

  @ApiProperty({
    description: 'Parsing status',
    enum: ['parsed'],
    example: 'parsed',
  })
  status: string;

  @ApiProperty({
    description: 'Markdown content length',
    example: 15420,
  })
  markdownLength: number;
}

/**
 * Response DTO for getting upload details
 */
export class GetUploadDetailsResponseDto {
  @ApiProperty({
    description: 'Upload ID',
    example: '507f1f77bcf86cd799439015',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the PDF',
    example: 'NEET 2023 Physics Paper',
  })
  title: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'neet-2023-physics-paper.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'S3 object key',
  })
  s3Key: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Upload status',
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

  @ApiPropertyOptional({
    description: 'Subject ID',
  })
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Topic ID',
  })
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Exam IDs',
    type: [String],
  })
  examIds?: string[];

  @ApiPropertyOptional({
    description:
      'S3 key for markdown file (if parsed). To retrieve markdown content, download from S3 using this key.',
  })
  markdownS3Key?: string;

  @ApiPropertyOptional({
    description: 'Error message (if failed)',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'When LLM enrichment last completed',
  })
  enrichedAt?: Date;

  @ApiPropertyOptional({
    description: 'Stats from the last enrichment run',
    type: 'object',
    additionalProperties: true,
  })
  enrichmentStats?: {
    total: number;
    success: number;
    failed: number;
    durationMs: number;
  };

  @ApiPropertyOptional({
    description: 'Count of cached enriched questions awaiting persistence',
    example: 23,
  })
  enrichedQuestionCount?: number;

  @ApiPropertyOptional({
    description:
      'Count of questions stored in failed_questions for this upload',
    example: 2,
  })
  rejectedQuestionCount?: number;

  @ApiProperty({
    description: 'Upload timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

/**
 * Metadata DTO for upload list (lightweight)
 */
export class UploadMetadataDto {
  @ApiProperty({
    description: 'Upload ID',
    example: '507f1f77bcf86cd799439015',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the PDF',
    example: 'NEET 2023 Physics Paper',
  })
  title: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'neet-2023-physics-paper.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Upload status',
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

  @ApiPropertyOptional({
    description: 'Subject ID',
  })
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Topic ID',
  })
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Exam IDs',
    type: [String],
  })
  examIds?: string[];

  @ApiPropertyOptional({
    description: 'S3 key for PDF',
  })
  s3Key?: string;

  @ApiPropertyOptional({
    description: 'S3 key for markdown (if parsed)',
  })
  markdownS3Key?: string;

  @ApiPropertyOptional({
    description: 'Error message (if failed)',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Upload timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

/**
 * Query parameters for GET /imports/uploads
 */
export class ListUploadsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by subject ObjectId',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'subjectId must be a valid MongoDB ObjectId' })
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Filter by topic ObjectId',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId({ message: 'topicId must be a valid MongoDB ObjectId' })
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Filter by upload processing status',
    enum: UPLOAD_STATUSES,
    example: 'enriched',
  })
  @IsOptional()
  @IsEnum(UPLOAD_STATUSES, {
    message: `status must be one of: ${UPLOAD_STATUSES.join(', ')}`,
  })
  status?: UploadStatus;

  @ApiPropertyOptional({
    description: 'Case-insensitive search on the original PDF filename',
    example: 'neet-physics',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Pagination metadata for the uploads list
 */
export class UploadsPaginationDto {
  @ApiProperty({ description: 'Current page number (1-based)', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of uploads', example: 42 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}

/**
 * Paginated list response DTO for uploads.
 * Frontend can categorize items client-side using each item's `status`.
 */
export class UploadsListResponseDto {
  @ApiProperty({
    description: 'Uploaded question paper PDFs for the requested page',
    type: [UploadMetadataDto],
  })
  uploads: UploadMetadataDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: UploadsPaginationDto,
  })
  pagination: UploadsPaginationDto;
}
