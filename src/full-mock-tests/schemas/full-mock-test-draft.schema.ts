import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FullMockTestDraftDocument = FullMockTestDraft & Document;

export const DRAFT_STATUSES = [
  'GENERATING',
  'REVIEW',
  'PUBLISHING',
  'PUBLISHED',
  'DISCARDED',
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

@Schema({ _id: false })
export class DraftExamSubjectSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subject: Types.ObjectId;

  @Prop({ trim: true })
  name: string;

  @Prop({ required: true })
  numberOfQuestions: number;

  @Prop({ required: true })
  marksPerQuestion: number;

  @Prop({ required: true, default: false })
  hasNegativeMarking: boolean;

  @Prop({ default: 0 })
  negativeMarksPerQuestion: number;

  @Prop()
  sessionTime?: number;
}

export const DraftExamSubjectSnapshotSchema = SchemaFactory.createForClass(
  DraftExamSubjectSnapshot,
);

@Schema({ _id: false })
export class DraftExamSnapshot {
  @Prop()
  name: string;

  @Prop()
  description?: string;

  @Prop()
  duration?: number;

  @Prop()
  totalQuestions: number;

  @Prop()
  totalMarks?: number;

  @Prop({ default: false })
  isSessionWise: boolean;

  @Prop({ type: [DraftExamSubjectSnapshotSchema], default: [] })
  subjects: DraftExamSubjectSnapshot[];
}

export const DraftExamSnapshotSchema =
  SchemaFactory.createForClass(DraftExamSnapshot);

@Schema({ _id: false })
export class DraftQuestion {
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

export const DraftQuestionSchema = SchemaFactory.createForClass(DraftQuestion);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'fullmocktestdrafts',
})
export class FullMockTestDraft {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  exam: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;

  @Prop({
    type: String,
    enum: DRAFT_STATUSES,
    default: 'REVIEW',
    index: true,
  })
  status: DraftStatus;

  @Prop({ type: DraftExamSnapshotSchema, required: true })
  examSnapshot: DraftExamSnapshot;

  @Prop({ type: [DraftQuestionSchema], default: [] })
  questions: DraftQuestion[];

  @Prop({ type: Types.ObjectId, ref: 'MockTest' })
  publishedMockTestId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FullMockTestDraftSchema =
  SchemaFactory.createForClass(FullMockTestDraft);

FullMockTestDraftSchema.index({ exam: 1, status: 1, createdAt: -1 });

FullMockTestDraftSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

FullMockTestDraftSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

FullMockTestDraftSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
