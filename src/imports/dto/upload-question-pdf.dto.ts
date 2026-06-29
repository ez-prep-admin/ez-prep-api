import {
  IsString,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for uploading a question paper PDF
 * Includes file upload and metadata for categorization
 */
export class UploadQuestionPdfDto {
  /**
   * PDF file (handled by Multer middleware)
   * Not a class property - file is added to request by Multer
   */

  @ApiPropertyOptional({
    description: 'Title/name for the PDF (user-friendly identifier). If not provided, a UUID will be generated.',
    example: 'NEET 2023 Physics Paper',
  })
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Subject ID for the question paper',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'Subject ID must be a valid MongoDB ObjectId' })
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Topic ID for the question paper',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId({ message: 'Topic ID must be a valid MongoDB ObjectId' })
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Array of Exam IDs this question paper belongs to',
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Exam IDs must be an array' })
  @ArrayMinSize(1, { message: 'At least one exam ID is required if provided' })
  @IsMongoId({ each: true, message: 'Each exam ID must be a valid MongoDB ObjectId' })
  examIds?: string[];

  @ApiPropertyOptional({
    description: 'Difficulty level of the questions',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'], {
    message: 'Difficulty level must be one of: easy, medium, hard',
  })
  difficultyLevel?: 'easy' | 'medium' | 'hard';

  @ApiPropertyOptional({
    description: 'Additional metadata as key-value pairs',
    example: { examYear: '2023', testSeries: 'NEET Mock Test' },
    type: 'object',
  })
  @IsOptional()
  metadata?: Record<string, string>;
}

/**
 * Response DTO for successful PDF upload
 */
export class UploadQuestionPdfResponseDto {
  @ApiProperty({
    description: 'Upload ID (MongoDB document ID)',
    example: '507f1f77bcf86cd799439015',
  })
  uploadId: string;

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
    description: 'S3 object key (path)',
    example: 'question-uploads/user123/2023-06-29/1719648000000-neet-2023-physics-paper.pdf',
  })
  s3Key: string;

  @ApiProperty({
    description: 'S3 bucket name',
    example: 'ez-prep-question-uploads',
  })
  s3Bucket: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Upload status',
    enum: ['uploaded', 'parsing', 'parsed', 'processing', 'completed', 'failed'],
    example: 'uploaded',
  })
  status: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2023-06-29T10:30:00.000Z',
  })
  uploadedAt: Date;
}
