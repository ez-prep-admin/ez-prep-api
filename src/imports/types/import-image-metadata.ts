/**
 * Image metadata aligned with the Question Mongoose schema.
 * For imported Mathpix images, bucket/key are placeholders until S3 upload is built.
 */
export interface ImportImageMetadata {
  key: string;
  bucket: string;
  region: string;
  contentType?: string;
  url?: string;
}

/** Placeholder bucket used until images are migrated to S3. */
export const MATHPIX_PENDING_BUCKET = 'mathpix-import-pending';
export const EXTERNAL_IMAGE_REGION = 'external';
