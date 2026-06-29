/**
 * Image metadata aligned with the Question Mongoose schema.
 */
export interface ImportImageMetadata {
  key: string;
  bucket: string;
  region: string;
  contentType?: string;
  size?: number;
  lastModified?: Date;
  /** Accessible URL — source CDN before upload, presigned S3 URL after */
  url?: string;
}

/** Placeholder bucket until images are uploaded to AWS_S3_IMAGE_BUCKET */
export const MATHPIX_PENDING_BUCKET = 'mathpix-import-pending';
export const EXTERNAL_IMAGE_REGION = 'external';

export function isPendingImportImage(image: ImportImageMetadata): boolean {
  return (
    image.bucket === MATHPIX_PENDING_BUCKET ||
    image.region === EXTERNAL_IMAGE_REGION
  );
}
