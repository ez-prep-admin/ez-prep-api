import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query } from 'mongoose';

export type CurrentAffairDocument = CurrentAffair & Document;

@Schema({ _id: false })
export class CurrentAffairImage {
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  bucket: string;

  @Prop({ type: String, required: true })
  region: string;

  @Prop({ type: String })
  contentType?: string;

  @Prop({ type: Number })
  size?: number;

  @Prop({ type: Date })
  lastModified?: Date;
}

export const CurrentAffairImageSchema =
  SchemaFactory.createForClass(CurrentAffairImage);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'currentaffairs',
})
export class CurrentAffair {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  description: string;

  @Prop({ trim: true, maxlength: 1000 })
  memoryTrick?: string;

  @Prop({ required: true, index: true })
  dateKey: string;

  @Prop({ type: CurrentAffairImageSchema })
  image?: CurrentAffairImage;

  @Prop({ required: true, default: 0 })
  sortOrder: number;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CurrentAffairSchema = SchemaFactory.createForClass(CurrentAffair);

CurrentAffairSchema.index({ title: 'text', description: 'text' });
CurrentAffairSchema.index({ dateKey: 1, isDeleted: 1, sortOrder: 1 });
CurrentAffairSchema.index({ dateKey: 1, isActive: 1, isDeleted: 1 });

CurrentAffairSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

CurrentAffairSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

CurrentAffairSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

CurrentAffairSchema.pre(
  /^find/,
  function (this: Query<unknown, CurrentAffairDocument>) {
    this.where({ isDeleted: { $ne: true } });
  },
);
