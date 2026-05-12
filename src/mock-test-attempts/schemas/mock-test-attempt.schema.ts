import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MockTestAttemptDocument = MockTestAttempt & Document;

@Schema({ _id: false })
export class AttemptQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Question' })
  question: Types.ObjectId;

  @Prop({ type: String, default: null })
  selectedOption: string | null;

  @Prop({ type: Boolean, default: null })
  isCorrect: boolean | null;

  @Prop({ type: Number, default: 0 })
  marksAwarded: number;
}

export const AttemptQuestionSchema =
  SchemaFactory.createForClass(AttemptQuestion);

@Schema({ _id: false })
export class AttemptDifficultyDistribution {
  @Prop({ type: Number, default: 0 })
  easy: number;

  @Prop({ type: Number, default: 0 })
  medium: number;

  @Prop({ type: Number, default: 0 })
  hard: number;
}

export const AttemptDifficultyDistributionSchema = SchemaFactory.createForClass(
  AttemptDifficultyDistribution,
);

@Schema({ _id: false })
export class PauseResumeEvent {
  @Prop({ type: String, enum: ['PAUSE', 'RESUME'], required: true })
  action: string;

  @Prop({ type: Date, required: true })
  timestamp: Date;

  @Prop({ type: Number })
  timeConsumedAtPause?: number; // Time consumed when paused (in seconds)
}

export const PauseResumeEventSchema =
  SchemaFactory.createForClass(PauseResumeEvent);

@Schema({
  timestamps: true,
  versionKey: false,
})
export class MockTestAttempt {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'MockTest',
    required: true,
    index: true,
  })
  mockTest: Types.ObjectId;

  // Freeze configuration snapshot from the mock test
  @Prop()
  testTitle: string;

  @Prop()
  totalQuestions: number;

  @Prop()
  durationInMinutes: number;

  @Prop({ type: Types.ObjectId, ref: 'Exam' })
  exam: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subject: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Topic' })
  topic?: Types.ObjectId;

  @Prop()
  marksPerQuestion: number;

  @Prop()
  negativeMarking: number;

  @Prop()
  passingScore?: number;

  @Prop()
  shuffleOptions: boolean;

  @Prop()
  showResultsImmediately: boolean;

  @Prop({ type: AttemptDifficultyDistributionSchema })
  difficultyDistribution?: AttemptDifficultyDistribution;

  // Locked question set
  @Prop({ type: [AttemptQuestionSchema], default: [] })
  questions: AttemptQuestion[];

  @Prop({ default: 0 })
  score: number;

  @Prop({
    type: String,
    enum: ['IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'EXPIRED'],
    default: 'IN_PROGRESS',
    index: true,
  })
  status: string;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  submittedAt?: Date;

  // Pause/Resume tracking
  @Prop({ type: Number, default: 0 })
  timeConsumed: number; // Total time consumed in seconds (accumulated across pause/resume cycles)

  @Prop()
  pausedAt?: Date; // When the attempt was last paused

  @Prop({ type: [PauseResumeEventSchema], default: [] })
  pauseResumeHistory: PauseResumeEvent[]; // Track all pause/resume events

  // Timestamps are automatically added by mongoose when timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const MockTestAttemptSchema =
  SchemaFactory.createForClass(MockTestAttempt);

// Compound indexes for better query performance
MockTestAttemptSchema.index({ user: 1, mockTest: 1 });

// Analytics-optimized index: covers all per-user dashboard aggregation $match stages
MockTestAttemptSchema.index({ user: 1, status: 1, submittedAt: -1 });

// Virtual for id field (removes _id and adds id)
MockTestAttemptSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
MockTestAttemptSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Also set toObject to include virtuals
MockTestAttemptSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
