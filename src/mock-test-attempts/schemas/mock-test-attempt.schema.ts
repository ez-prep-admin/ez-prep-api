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
  test: Types.ObjectId;

  // Freeze configuration snapshot from the test
  @Prop()
  testTitle: string;

  @Prop()
  totalQuestions: number;

  @Prop()
  durationInMinutes: number;

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

  // Locked question set
  @Prop({ type: [AttemptQuestionSchema], default: [] })
  questions: AttemptQuestion[];

  @Prop({ default: 0 })
  score: number;

  @Prop({
    type: String,
    enum: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'],
    default: 'IN_PROGRESS',
    index: true,
  })
  status: string;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  submittedAt?: Date;

  // Timestamps are automatically added by mongoose when timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const MockTestAttemptSchema =
  SchemaFactory.createForClass(MockTestAttempt);

// Compound indexes for better query performance
MockTestAttemptSchema.index({ user: 1, test: 1 });
MockTestAttemptSchema.index({ status: 1 });

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
