import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AwsConfigService } from '../config/aws.config';
import {
  S3UploadOptions,
  S3UploadResult,
  S3DownloadOptions,
  S3DownloadResult,
  S3DeleteOptions,
  S3DeleteResult,
  S3ListOptions,
  S3ListResult,
  S3ObjectMetadata,
  S3PresignedUrlOptions,
  S3PresignedUrlResult,
} from './s3.types';

/**
 * Generic S3 Service for file operations
 * Reusable across the entire application for any file storage needs
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly defaultBucket: string;
  private readonly region: string;

  constructor(private readonly awsConfig: AwsConfigService) {
    // Initialize S3 client with AWS credentials
    this.s3Client = new S3Client({
      region: this.awsConfig.region,
      credentials: {
        accessKeyId: this.awsConfig.accessKeyId,
        secretAccessKey: this.awsConfig.secretAccessKey,
      },
    });

    this.defaultBucket = this.awsConfig.s3Bucket;
    this.region = this.awsConfig.region;

    this.logger.log(
      `[s3] Initialized S3 client (region=${this.region}, bucket=${this.defaultBucket})`,
    );
  }

  /**
   * Upload a file to S3
   * @param file File buffer to upload
   * @param options Upload configuration options
   * @returns Upload result with S3 details
   */
  async uploadFile(
    file: Buffer,
    options: S3UploadOptions = {},
  ): Promise<S3UploadResult> {
    const bucket = options.bucket ?? this.defaultBucket;
    const key = options.key ?? this.generateKey();
    const contentType = options.contentType ?? 'application/octet-stream';

    this.logger.log(`[s3] Uploading file: ${key} to bucket: ${bucket}`);

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
        ...(options.acl ? { ACL: options.acl } : {}),
        Metadata: options.metadata,
        Tagging: options.tags
          ? Object.entries(options.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join('&')
          : undefined,
      });

      const response = await this.s3Client.send(command);

      const result: S3UploadResult = {
        key,
        bucket,
        region: this.region,
        etag: response.ETag ?? '',
        size: file.length,
        contentType,
        uploadedAt: new Date(),
        location:
          options.acl === 'public-read'
            ? `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`
            : undefined,
      };

      this.logger.log(
        `[s3] Upload successful: ${key} (${file.length} bytes, etag=${response.ETag})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[s3] Upload failed for ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Download a file from S3
   * @param key S3 object key
   * @param bucket Bucket name (optional, uses default)
   * @param options Download options
   * @returns File content and metadata
   */
  async downloadFile(
    key: string,
    bucket?: string,
    options: S3DownloadOptions = {},
  ): Promise<S3DownloadResult> {
    const targetBucket = bucket ?? this.defaultBucket;

    this.logger.log(
      `[s3] Downloading file: ${key} from bucket: ${targetBucket}`,
    );

    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
        Range: options.range,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new NotFoundException(`File not found: ${key}`);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      const result: S3DownloadResult = {
        body,
        contentType: response.ContentType,
        contentLength: response.ContentLength ?? body.length,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      };

      this.logger.log(
        `[s3] Download successful: ${key} (${result.contentLength} bytes)`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[s3] Download failed for ${key}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to download file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a file from S3
   * @param key S3 object key
   * @param bucket Bucket name (optional, uses default)
   * @param options Delete options
   * @returns Delete result
   */
  async deleteFile(
    key: string,
    bucket?: string,
    _options?: S3DeleteOptions,
  ): Promise<S3DeleteResult> {
    const targetBucket = bucket ?? this.defaultBucket;

    this.logger.log(`[s3] Deleting file: ${key} from bucket: ${targetBucket}`);

    try {
      const command = new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      const result: S3DeleteResult = {
        deleted: true,
        key,
        versionId: response.VersionId,
      };

      this.logger.log(`[s3] Delete successful: ${key}`);

      return result;
    } catch (error) {
      this.logger.error(
        `[s3] Delete failed for ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        `Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * List objects in S3 bucket
   * @param options List options (prefix, max keys, pagination)
   * @param bucket Bucket name (optional, uses default)
   * @returns List of objects with metadata
   */
  async listObjects(
    options: S3ListOptions = {},
    bucket?: string,
  ): Promise<S3ListResult> {
    const targetBucket = bucket ?? this.defaultBucket;
    const maxKeys = options.maxKeys ?? 1000;

    this.logger.log(
      `[s3] Listing objects in bucket: ${targetBucket} (prefix=${options.prefix ?? 'none'}, maxKeys=${maxKeys})`,
    );

    try {
      const command = new ListObjectsV2Command({
        Bucket: targetBucket,
        Prefix: options.prefix,
        MaxKeys: maxKeys,
        ContinuationToken: options.continuationToken,
      });

      const response = await this.s3Client.send(command);

      const objects: S3ObjectMetadata[] =
        response.Contents?.map(item => ({
          key: item.Key!,
          size: item.Size ?? 0,
          lastModified: item.LastModified ?? new Date(),
          etag: item.ETag ?? '',
          contentType: undefined,
        })) ?? [];

      const result: S3ListResult = {
        objects,
        isTruncated: response.IsTruncated ?? false,
        nextContinuationToken: response.NextContinuationToken,
        keyCount: response.KeyCount ?? 0,
      };

      this.logger.log(
        `[s3] List successful: ${result.keyCount} objects found (truncated=${result.isTruncated})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[s3] List failed`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        `Failed to list objects from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate a pre-signed URL for temporary access to a private object
   * @param key S3 object key
   * @param bucket Bucket name (optional, uses default)
   * @param options Pre-signed URL options
   * @returns Pre-signed URL with expiration
   */
  async getPresignedUrl(
    key: string,
    bucket?: string,
    options: S3PresignedUrlOptions = {},
  ): Promise<S3PresignedUrlResult> {
    const targetBucket = bucket ?? this.defaultBucket;
    const expiresIn = options.expiresIn ?? 3600; // 1 hour default

    this.logger.log(
      `[s3] Generating pre-signed URL for: ${key} (expires in ${expiresIn}s)`,
    );

    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
        ResponseContentType: options.responseContentType,
        ResponseContentDisposition: options.responseContentDisposition,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const result: S3PresignedUrlResult = {
        url,
        expiresAt,
        key,
        bucket: targetBucket,
      };

      this.logger.log(
        `[s3] Pre-signed URL generated: ${key} (expires at ${expiresAt.toISOString()})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[s3] Pre-signed URL generation failed for ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        `Failed to generate pre-signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if an object exists in S3
   * @param key S3 object key
   * @param bucket Bucket name (optional, uses default)
   * @returns true if object exists, false otherwise
   */
  async objectExists(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket ?? this.defaultBucket;

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate a unique S3 key (path) for a file
   * Format: uploads/{timestamp}-{random}/{filename}
   * @param filename Original filename (optional)
   * @returns Generated S3 key
   */
  private generateKey(filename?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const name = filename ?? `file-${random}`;
    return `uploads/${timestamp}-${random}/${name}`;
  }

  /**
   * Generate a structured key for question paper uploads
   * Format: question-uploads/pdfs/{filename}
   * @param userId User ID who uploaded the file
   * @param filename Original filename
   * @returns Generated S3 key
   */
  generateQuestionUploadKey(_userId: string, filename: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `question-uploads/pdfs/${sanitized}`;
  }

  /**
   * Generate a structured key for parsed question paper markdown
   * Format: question-uploads/markdowns/{filename}
   */
  generateQuestionMarkdownKey(_userId: string, filename: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `question-uploads/markdowns/${sanitized}`;
  }

  /**
   * Structured key for imported question images
   * Format: question-imports/{uploadId}/q{number}/{slot}-{hash}.{ext}
   */
  generateImportImageKey(
    uploadId: string,
    questionNumber: number,
    slot: string,
    extension: string,
    sourceUrl: string,
  ): string {
    const hash = createHash('sha256')
      .update(sourceUrl)
      .digest('hex')
      .slice(0, 12);
    const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `question-imports/${safeUploadId}/q${questionNumber}/${safeSlot}-${hash}.${extension}`;
  }
}
