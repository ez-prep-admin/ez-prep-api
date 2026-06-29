import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AWS Configuration Service
 * Validates and provides AWS credentials and settings
 */
@Injectable()
export class AwsConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get AWS access key ID
   * REQUIRED: Set AWS_ACCESS_KEY_ID in environment variables
   */
  get accessKeyId(): string {
    const value = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    if (!value) {
      throw new Error(
        'AWS_ACCESS_KEY_ID is not configured. Please set it in your .env file.',
      );
    }
    return value;
  }

  /**
   * Get AWS secret access key
   * REQUIRED: Set AWS_SECRET_ACCESS_KEY in environment variables
   */
  get secretAccessKey(): string {
    const value = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    if (!value) {
      throw new Error(
        'AWS_SECRET_ACCESS_KEY is not configured. Please set it in your .env file.',
      );
    }
    return value;
  }

  /**
   * Get AWS region
   * REQUIRED: Set AWS_REGION in environment variables
   * @default 'us-east-1'
   */
  get region(): string {
    return this.configService.get<string>('AWS_REGION', 'us-east-1');
  }

  /**
   * Get default S3 bucket name
   * REQUIRED: Set AWS_S3_BUCKET in environment variables
   */
  get s3Bucket(): string {
    const value = this.configService.get<string>('AWS_S3_BUCKET');
    if (!value) {
      throw new Error(
        'AWS_S3_BUCKET is not configured. Please set it in your .env file.',
      );
    }
    return value;
  }

  /**
   * Get S3 bucket for question uploads
   * Optional: Set AWS_S3_QUESTION_UPLOADS_BUCKET for separate bucket
   * Falls back to default S3 bucket
   */
  get s3QuestionUploadsBucket(): string {
    return this.configService.get<string>(
      'AWS_S3_QUESTION_UPLOADS_BUCKET',
      this.s3Bucket,
    );
  }

  /**
   * Dedicated bucket for question/option/explanation images
   */
  get s3ImageBucket(): string {
    const value = this.configService.get<string>('AWS_S3_IMAGE_BUCKET');
    if (!value) {
      throw new Error(
        'AWS_S3_IMAGE_BUCKET is not configured. Please set it in your .env file.',
      );
    }
    return value;
  }

  /**
   * Validate all required AWS configuration
   * Call this during module initialization
   */
  validateConfig(): void {
    void this.accessKeyId;
    void this.secretAccessKey;
    void this.region;
    void this.s3Bucket;
    void this.s3ImageBucket;
  }
}
