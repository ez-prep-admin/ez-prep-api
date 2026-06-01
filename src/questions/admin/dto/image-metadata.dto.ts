import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ImageMetadataDto {
  @ApiProperty({ description: 'S3 object key', example: 'questions/abc123.jpg' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'S3 bucket name', example: 'ez-prep-images' })
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @ApiProperty({ description: 'AWS region', example: 'ap-south-1' })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiPropertyOptional({ description: 'File MIME type', example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 102400 })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiPropertyOptional({ description: 'Upload timestamp' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastModified?: Date;

  @ApiPropertyOptional({
    description: 'Pre-signed URL',
    example: 'https://ez-prep-images.s3.ap-south-1.amazonaws.com/...',
  })
  @IsOptional()
  @IsString()
  url?: string;
}
