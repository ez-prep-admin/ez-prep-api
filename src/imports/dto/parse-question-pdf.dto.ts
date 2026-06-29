import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Markdown content extracted from PDF (returned in immediate response only, not stored in database for space efficiency)',
  })
  markdown: string;

  @ApiPropertyOptional({
    description: 'S3 key where markdown is saved (use this to retrieve markdown in future requests)',
    example: 'question-uploads/anonymous/2023-06-29/markdown/1688035200000-neet_2023_physics.md',
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
    enum: ['uploaded', 'parsing', 'parsed', 'processing', 'completed', 'failed'],
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
    description: 'Difficulty level',
  })
  difficultyLevel?: string;

  @ApiPropertyOptional({
    description: 'S3 key for markdown file (if parsed). To retrieve markdown content, download from S3 using this key.',
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
    enum: ['uploaded', 'parsing', 'parsed', 'processing', 'completed', 'failed'],
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
    description: 'Difficulty level',
  })
  difficultyLevel?: string;

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
 * Categorized list response DTO
 */
export class CategorizedUploadsResponseDto {
  @ApiProperty({
    description: 'PDFs that have been converted to markdown',
    type: [UploadMetadataDto],
  })
  parsed: UploadMetadataDto[];

  @ApiProperty({
    description: 'PDFs that have not been converted yet',
    type: [UploadMetadataDto],
  })
  unparsed: UploadMetadataDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    parsedCount: number;
    unparsedCount: number;
  };
}
