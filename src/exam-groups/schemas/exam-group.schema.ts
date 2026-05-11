import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type ExamGroupDocument = ExamGroup & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'examgroups',
})
export class ExamGroup {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ trim: true })
  shortName?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  category: Types.ObjectId;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ExamGroupSchema = SchemaFactory.createForClass(ExamGroup);

// Text index for search functionality
ExamGroupSchema.index({ name: 'text', shortName: 'text' });

// Compound indexes for filtering
ExamGroupSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
ExamGroupSchema.index({ isActive: 1, isDeleted: 1 });

// Virtual for id field
ExamGroupSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
ExamGroupSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ExamGroupSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
ExamGroupSchema.pre(
  /^find/,
  function (this: Query<unknown, ExamGroupDocument>) {
    this.where({ isDeleted: { $ne: true } });
  },
);
