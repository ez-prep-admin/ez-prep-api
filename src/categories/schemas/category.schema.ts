import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'categories',
})
export class Category {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, trim: true, uppercase: true, index: true })
  shortName: string;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Text index for search functionality
CategorySchema.index({ name: 'text', shortName: 'text' });

// Compound index for filtering
CategorySchema.index({ isActive: 1, isDeleted: 1 });

// Virtual for id field
CategorySchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
CategorySchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

CategorySchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
CategorySchema.pre(/^find/, function (this: any) {
  this.where({ isDeleted: { $ne: true } });
});
