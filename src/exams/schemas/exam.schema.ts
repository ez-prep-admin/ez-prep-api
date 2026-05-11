import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type ExamDocument = Exam & Document;

// ExamSubject sub-schema
@Schema({ _id: false })
export class ExamSubject {
  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true, index: true })
  subject: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  numberOfQuestions: number;

  @Prop({ required: true, min: 0 })
  marksPerQuestion: number;

  @Prop({ required: true, default: false })
  hasNegativeMarking: boolean;

  @Prop({ min: 0, default: 0 })
  negativeMarksPerQuestion: number;

  @Prop({ min: 0 })
  sessionTime?: number;
}

export const ExamSubjectSchema = SchemaFactory.createForClass(ExamSubject);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'exams',
})
export class Exam {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  category: Types.ObjectId;

  @Prop({ min: 0 })
  duration?: number;

  @Prop({ min: 0 })
  totalQuestions?: number;

  @Prop({ min: 0 })
  totalMarks?: number;

  @Prop({ type: [ExamSubjectSchema], default: [] })
  subjects: ExamSubject[];

  @Prop({ default: false })
  isSessionWise: boolean;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);

// Text index for search functionality
ExamSchema.index({ name: 'text', description: 'text' });

// Compound indexes for filtering
ExamSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
ExamSchema.index({ isActive: 1, isDeleted: 1 });

// Virtual for id field
ExamSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
ExamSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ExamSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
ExamSchema.pre(/^find/, function (this: Query<unknown, ExamDocument>) {
  this.where({ isDeleted: { $ne: true } });
});
