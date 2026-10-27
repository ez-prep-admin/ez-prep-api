import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AccessMode } from '../../common/enums/access-mode.enum';
import {
  DifficultyDistribution,
  DifficultyDistributionSchema,
} from './mock-test.schema';

export type TopicWiseMockTestDraftDocument = TopicWiseMockTestDraft & Document;

export const TOPIC_WISE_DRAFT_STATUSES = [
  'GENERATING',
  'REVIEW',
  'PUBLISHING',
  'PUBLISHED',
  'DISCARDED',
] as const;

export type TopicWiseDraftStatus = (typeof TOPIC_WISE_DRAFT_STATUSES)[number];

@Schema({ _id: false })
export class TopicWiseDraftQuestion {
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

export const TopicWiseDraftQuestionSchema = SchemaFactory.createForClass(
  TopicWiseDraftQuestion,
);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'topicwisetestdrafts',
})
export class TopicWiseMockTestDraft {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  exam: Types.ObjectId;

  @Prop({ trim: true })
  examName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true, index: true })
  subject: Types.ObjectId;

  @Prop({ trim: true })
  subjectName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Topic' })
  topic?: Types.ObjectId;

  @Prop({ trim: true })
  topicName?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: String,
    enum: TOPIC_WISE_DRAFT_STATUSES,
    default: 'REVIEW',
    index: true,
  })
  status: TopicWiseDraftStatus;

  @Prop({ required: true, min: 1 })
  totalQuestions: number;

  @Prop({ required: true, min: 1 })
  durationInMinutes: number;

  @Prop({ type: DifficultyDistributionSchema, required: true })
  difficultyDistribution: DifficultyDistribution;

  @Prop({ trim: true })
  title?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: ['STATIC', 'DYNAMIC'],
    default: 'STATIC',
  })
  generationMode: string;

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

  @Prop({
    enum: Object.values(AccessMode),
    default: AccessMode.FREE,
  })
  accessMode: AccessMode;

  @Prop({ type: [TopicWiseDraftQuestionSchema], default: [] })
  questions: TopicWiseDraftQuestion[];

  @Prop({ type: Types.ObjectId, ref: 'MockTest' })
  publishedMockTestId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TopicWiseMockTestDraftSchema = SchemaFactory.createForClass(
  TopicWiseMockTestDraft,
);

TopicWiseMockTestDraftSchema.index({ exam: 1, status: 1, updatedAt: -1 });

TopicWiseMockTestDraftSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

TopicWiseMockTestDraftSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

TopicWiseMockTestDraftSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
