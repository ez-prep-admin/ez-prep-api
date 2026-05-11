import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type SubjectDocument = Subject & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'subjects',
})
export class Subject {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Topic' }],
    default: [],
  })
  topics: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);

// Virtual for id field
SubjectSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
SubjectSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

SubjectSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
SubjectSchema.pre(/^find/, function (this: Query<unknown, SubjectDocument>) {
  this.where({ isDeleted: { $ne: true } });
});
