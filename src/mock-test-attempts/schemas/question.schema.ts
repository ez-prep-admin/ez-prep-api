import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionDocument = Question & Document;

// Read-only schema for questions created by external application
@Schema({
  collection: 'questions', // Use existing collection name
  timestamps: true,
  versionKey: false,
})
export class Question {
  @Prop({ type: Object, required: true })
  questionText: Record<string, { text: string | null; image: string | null }>;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: Array, required: true })
  options: Array<{
    id: string;
    type: string;
    en: string | null;
    ml: string | null;
    url: string | null;
    _id: any;
  }>;

  @Prop({ type: String })
  correctAnswer: string;

  @Prop({ type: Object })
  explanation?: Record<string, string>;

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subject?: Types.ObjectId;

  @Prop({ type: String, enum: ['easy', 'medium', 'hard'] })
  difficulty?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

// Virtual for id field
QuestionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
QuestionSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

QuestionSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
QuestionSchema.pre(/^find/, function (this: any) {
  this.where({ isDeleted: { $ne: true } });
});
