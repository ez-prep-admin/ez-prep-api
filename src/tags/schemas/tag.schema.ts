import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TagDocument = Tag & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'tags',
})
export class Tag {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

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
    required: true,
    index: true,
  })
  topic: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TagSchema = SchemaFactory.createForClass(Tag);

// Compound index for subject + topic + name uniqueness
TagSchema.index({ subject: 1, topic: 1, name: 1 }, { unique: true });

// Virtual for id field
TagSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
TagSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

TagSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
TagSchema.pre(/^find/, function (this: any) {
  this.where({ isDeleted: { $ne: true } });
});
