import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SprintTestDraftDocument = SprintTestDraft & Document;

export const SPRINT_DRAFT_STATUSES = [
  'GENERATING',
  'REVIEW',
  'PUBLISHING',
  'PUBLISHED',
  'DISCARDED',
] as const;

export type SprintDraftStatus = (typeof SPRINT_DRAFT_STATUSES)[number];

@Schema({ _id: false })
export class SprintDraftQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  question: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subject: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Topic' })
  topic?: Types.ObjectId;

  @Prop()
  difficultyLevel?: string;

  @Prop({ required: true, min: 0 })
  position: number;

  @Prop({ required: true })
  marksPerQuestion: number;

  @Prop({ required: true, default: 0 })
  negativeMarking: number;

  @Prop({ type: Types.ObjectId, ref: 'Question' })
  replacedFrom?: Types.ObjectId;
}

export const SprintDraftQuestionSchema =
  SchemaFactory.createForClass(SprintDraftQuestion);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'sprinttestdrafts',
})
export class SprintTestDraft {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  exam: Types.ObjectId;

  @Prop({ trim: true })
  examName?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;

  @Prop({
    type: String,
    enum: SPRINT_DRAFT_STATUSES,
    default: 'REVIEW',
    index: true,
  })
  status: SprintDraftStatus;

  @Prop({ required: true, min: 1 })
  totalQuestions: number;

  @Prop({ required: true, min: 1 })
  durationInMinutes: number;

  @Prop({ trim: true })
  title?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, min: 0 })
  marksPerQuestion: number;

  @Prop({ required: true, min: 0, default: 0 })
  negativeMarking: number;

  @Prop({ min: 0 })
  passingScore?: number;

  @Prop({ default: true })
  allowRetake: boolean;

  @Prop({ default: false })
  shuffleOptions: boolean;

  @Prop({ default: true })
  showResultsImmediately: boolean;

  @Prop({ type: [SprintDraftQuestionSchema], default: [] })
  questions: SprintDraftQuestion[];

  @Prop({ type: Types.ObjectId, ref: 'MockTest' })
  publishedMockTestId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SprintTestDraftSchema =
  SchemaFactory.createForClass(SprintTestDraft);

SprintTestDraftSchema.index({ exam: 1, status: 1, updatedAt: -1 });

SprintTestDraftSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

SprintTestDraftSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

SprintTestDraftSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
