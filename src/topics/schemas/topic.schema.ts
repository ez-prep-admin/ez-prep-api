import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query } from 'mongoose';

export type TopicDocument = Topic & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'topics',
})
export class Topic {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TopicSchema = SchemaFactory.createForClass(Topic);

// Virtual for id field
TopicSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
TopicSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

TopicSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
TopicSchema.pre(/^find/, function (this: Query<unknown, TopicDocument>) {
  this.where({ isDeleted: { $ne: true } });
});
