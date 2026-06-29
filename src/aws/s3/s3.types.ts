/**
 * AWS S3 Service Types and Interfaces
 */

/**
 * Configuration for S3 file upload
 */
export interface S3UploadOptions {
  /**
   * Target bucket name (optional, falls back to default bucket)
   */
  bucket?: string;

  /**
   * Key (path) for the file in S3
   * If not provided, will be auto-generated
   */
  key?: string;

  /**
   * Content type of the file
   */
  contentType?: string;

  /**
   * ACL for the uploaded file
   * @default 'private'
   */
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';

  /**
   * Metadata to attach to the S3 object
   */
  metadata?: Record<string, string>;

  /**
   * Tags to apply to the S3 object
   */
  tags?: Record<string, string>;
}

/**
 * Result of S3 file upload
 */
export interface S3UploadResult {
  /**
   * S3 object key (path)
   */
  key: string;

  /**
   * Bucket name
   */
  bucket: string;

  /**
   * AWS region
   */
  region: string;

  /**
   * ETag of the uploaded object
   */
  etag: string;

  /**
   * Public URL (if ACL is public)
   */
  location?: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Content type
   */
  contentType: string;

  /**
   * Upload timestamp
   */
  uploadedAt: Date;
}

/**
 * Options for generating pre-signed URL
 */
export interface S3PresignedUrlOptions {
  /**
   * Expiration time in seconds
   * @default 3600 (1 hour)
   */
  expiresIn?: number;

  /**
   * Response content type
   */
  responseContentType?: string;

  /**
   * Response content disposition
   */
  responseContentDisposition?: string;
}

/**
 * Pre-signed URL result
 */
export interface S3PresignedUrlResult {
  /**
   * Pre-signed URL
   */
  url: string;

  /**
   * Expiration timestamp
   */
  expiresAt: Date;

  /**
   * Object key
   */
  key: string;

  /**
   * Bucket name
   */
  bucket: string;
}

/**
 * Options for listing S3 objects
 */
export interface S3ListOptions {
  /**
   * Prefix to filter objects
   */
  prefix?: string;

  /**
   * Maximum number of objects to return
   * @default 1000
   */
  maxKeys?: number;

  /**
   * Continuation token for pagination
   */
  continuationToken?: string;
}

/**
 * S3 object metadata
 */
export interface S3ObjectMetadata {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
}

/**
 * Result of S3 list operation
 */
export interface S3ListResult {
  objects: S3ObjectMetadata[];
  isTruncated: boolean;
  nextContinuationToken?: string;
  keyCount: number;
}

/**
 * Options for downloading file from S3
 */
export interface S3DownloadOptions {
  /**
   * Byte range to download (e.g., "bytes=0-1024")
   */
  range?: string;
}

/**
 * Result of S3 download operation
 */
export interface S3DownloadResult {
  /**
   * File content as Buffer
   */
  body: Buffer;

  /**
   * Content type
   */
  contentType?: string;

  /**
   * Content length
   */
  contentLength: number;

  /**
   * Last modified date
   */
  lastModified?: Date;

  /**
   * ETag
   */
  etag?: string;

  /**
   * Metadata attached to object
   */
  metadata?: Record<string, string>;
}

/**
 * Options for deleting objects from S3
 */
export interface S3DeleteOptions {
  /**
   * Whether to perform quiet delete (no confirmation)
   * @default false
   */
  quiet?: boolean;
}

/**
 * Result of S3 delete operation
 */
export interface S3DeleteResult {
  deleted: boolean;
  key: string;
  versionId?: string;
}
