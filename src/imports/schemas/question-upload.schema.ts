import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type QuestionUploadDocument = QuestionUpload & Document;

export const UPLOAD_STATUSES = [
  'uploaded',
  'parsing',
  'parsed',
  'processing',
  'completed',
  'failed',
] as const;

export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

/**
 * Schema for tracking question paper PDF uploads
 * Stores metadata about uploaded PDFs and their processing status
 */
@Schema({
  collection: 'question_uploads',
  timestamps: true,
  versionKey: false,
})
export class QuestionUpload {
  /**
   * Title/name for the upload (user-friendly identifier)
   * If not provided by user, a UUID will be generated
   */
  @Prop({ required: true, index: true })
  title: string;

  /**
   * Original filename
   */
  @Prop({ required: true })
  filename: string;

  /**
   * S3 object key (path)
   */
  @Prop({ required: true, unique: true })
  s3Key: string;

  /**
   * S3 bucket name
   */
  @Prop({ required: true })
  s3Bucket: string;

  /**
   * AWS region
   */
  @Prop({ required: true })
  s3Region: string;

  /**
   * File size in bytes
   */
  @Prop({ required: true })
  fileSize: number;

  /**
   * Content type (should be application/pdf)
   */
  @Prop({ required: true })
  contentType: string;

  /**
   * Upload status
   */
  @Prop({
    type: String,
    enum: UPLOAD_STATUSES,
    default: 'uploaded',
  })
  status: UploadStatus;

  /**
   * Subject ID (metadata for categorization)
   */
  @Prop({ type: Types.ObjectId, ref: 'Subject', index: true })
  subject?: Types.ObjectId;

  /**
   * Topic ID (metadata for categorization)
   */
  @Prop({ type: Types.ObjectId, ref: 'Topic', index: true })
  topic?: Types.ObjectId;

  /**
   * Exam IDs (metadata for categorization)
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Exam' }], default: [] })
  exams: Types.ObjectId[];

  /**
   * Difficulty level (metadata)
   */
  @Prop({ type: String, enum: ['easy', 'medium', 'hard'] })
  difficultyLevel?: string;

  /**
   * Question source type
   */
  @Prop({ type: String, default: 'PDF_UPLOAD' })
  source: string;

  /**
   * Additional metadata (flexible field for future use)
   */
  @Prop({ type: Map, of: String })
  metadata?: Map<string, string>;

  /**
   * S3 key for the saved markdown file
   * Markdown content is stored ONLY in S3, not in MongoDB
   */
  @Prop({ type: String })
  markdownS3Key?: string;

  /**
   * Mathpix PDF ID (for tracking)
   */
  @Prop({ type: String })
  mathpixPdfId?: string;

  /**
   * Parsing started timestamp
   */
  @Prop({ type: Date })
  parsingStartedAt?: Date;

  /**
   * Parsing completed timestamp
   */
  @Prop({ type: Date })
  parsingCompletedAt?: Date;

  /**
   * Processing error message (if failed)
   */
  @Prop({ type: String })
  errorMessage?: string;

  /**
   * Number of questions detected (populated after enrichment)
   */
  @Prop({ type: Number })
  questionCount?: number;

  /**
   * User who uploaded the file
   */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  uploadedBy?: Types.ObjectId;

  /**
   * Soft delete flag
   */
  @Prop({ default: false })
  isDeleted: boolean;

  /**
   * Timestamps
   */
  createdAt?: Date;
  updatedAt?: Date;
}

export const QuestionUploadSchema =
  SchemaFactory.createForClass(QuestionUpload);

// Virtual for id field
QuestionUploadSchema.virtual('id').get(function () {
  return this._id?.toString();
});

// Ensure virtual fields are serialized
QuestionUploadSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

QuestionUploadSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
QuestionUploadSchema.pre(
  /^find/,
  function (this: Query<unknown, QuestionUploadDocument>) {
    this.where({ isDeleted: { $ne: true } });
  },
);

// Index for efficient queries
QuestionUploadSchema.index({ status: 1, createdAt: -1 });
QuestionUploadSchema.index({ uploadedBy: 1, createdAt: -1 });
QuestionUploadSchema.index({ subject: 1, topic: 1 });
