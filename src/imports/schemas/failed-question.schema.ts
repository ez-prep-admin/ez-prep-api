import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EnrichError } from '../types/import-question';

export type FailedQuestionDocument = FailedQuestion & Document;

@Schema({ _id: false })
export class FailedQuestionSource {
  @Prop({ type: Number, required: true })
  number: number;

  @Prop({ type: String, required: true })
  question: string;

  @Prop({ type: String })
  solution?: string;
}

export const FailedQuestionSourceSchema =
  SchemaFactory.createForClass(FailedQuestionSource);

/**
 * Questions that failed LLM enrichment validation for a PDF upload.
 * Stored one document per failed question so each can be edited and retried independently.
 */
@Schema({
  collection: 'failed_questions',
  timestamps: true,
  versionKey: false,
})
export class FailedQuestion {
  @Prop({ type: Types.ObjectId, ref: 'QuestionUpload', required: true, index: true })
  uploadId: Types.ObjectId;

  @Prop({ type: Number, required: true, index: true })
  questionNumber: number;

  @Prop({ type: FailedQuestionSourceSchema, required: true })
  matchedQuestion: FailedQuestionSource;

  @Prop({
    type: String,
    enum: ['llm', 'zod', 'business', 'mapping', 'image'],
    required: true,
  })
  failureStage: EnrichError['stage'];

  @Prop({ type: String, required: true })
  failureMessage: string;

  /**
   * Partial question payload when enrichment progressed past LLM output
   * (e.g. zod/business failure). Omitted for chunk-level LLM failures.
   */
  @Prop({ type: Object })
  questionDraft?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FailedQuestionSchema =
  SchemaFactory.createForClass(FailedQuestion);

FailedQuestionSchema.virtual('id').get(function () {
  return this._id?.toString();
});

FailedQuestionSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

FailedQuestionSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

FailedQuestionSchema.index({ uploadId: 1, questionNumber: 1 }, { unique: true });
