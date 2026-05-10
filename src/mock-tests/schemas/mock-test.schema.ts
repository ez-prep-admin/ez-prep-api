import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MockTestDocument = MockTest & Document;

@Schema({ _id: false })
export class DifficultyDistribution {
  @Prop({ type: Number, default: 0 })
  easy: number;

  @Prop({ type: Number, default: 0 })
  medium: number;

  @Prop({ type: Number, default: 0 })
  hard: number;
}

export const DifficultyDistributionSchema = SchemaFactory.createForClass(
  DifficultyDistribution,
);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'mocktests', // Use existing collection name
})
export class MockTest {
  @Prop({ required: true, enum: [10, 15, 20, 25, 30] })
  totalQuestions: number;

  @Prop({ required: true, enum: [10, 15, 20, 25, 30] })
  durationInMinutes: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  exam: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true,
  })
  subject: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Topic',
    index: true,
  })
  topic?: Types.ObjectId;

  @Prop({ trim: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({
    type: String,
    enum: ['STATIC', 'DYNAMIC'],
    default: 'STATIC',
  })
  generationMode: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Question' }],
  })
  questionIds: Types.ObjectId[];

  @Prop({ default: 1 })
  marksPerQuestion: number;

  @Prop({ default: 0 })
  negativeMarking: number;

  @Prop()
  passingScore?: number;

  @Prop({ default: true })
  allowRetake: boolean;

  @Prop({ default: false })
  shuffleOptions: boolean;

  @Prop({ default: true })
  showResultsImmediately: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: DifficultyDistributionSchema, default: () => ({}) })
  difficultyDistribution: DifficultyDistribution;

  // Timestamps are automatically added by mongoose when timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const MockTestSchema = SchemaFactory.createForClass(MockTest);

// Indexes for better query performance
MockTestSchema.index({ title: 'text' }); // Text index for search
MockTestSchema.index({ isActive: 1, isDeleted: 1 });
MockTestSchema.index({ createdAt: -1 }); // For sorting by newest
MockTestSchema.index({ exam: 1, subject: 1 }); // For filtering by exam and subject
MockTestSchema.index({ exam: 1, subject: 1, topic: 1 }); // For filtering with topic

// Virtual for id field (removes _id and adds id)
MockTestSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
MockTestSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Also set toObject to include virtuals
MockTestSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
MockTestSchema.pre(/^find/, function (this: any) {
  // Only return non-deleted mock tests by default
  this.where({ isDeleted: { $ne: true } });
});
