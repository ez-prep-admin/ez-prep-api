import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

@Schema({ _id: false })
export class FeedbackRatings {
  @Prop({ min: 1, max: 5 })
  userInterface?: number;

  @Prop({ min: 1, max: 5 })
  questions?: number;

  @Prop({ min: 1, max: 5 })
  fullMockTests?: number;

  @Prop({ min: 1, max: 5 })
  topicWisePractice?: number;

  @Prop({ min: 1, max: 5 })
  easeOfUse?: number;
}

export const FeedbackRatingsSchema =
  SchemaFactory.createForClass(FeedbackRatings);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'feedbacks',
})
export class Feedback {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ trim: true, maxlength: 1000 })
  text?: string;

  @Prop({ type: FeedbackRatingsSchema, default: () => ({}) })
  ratings: FeedbackRatings;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.index({ createdAt: -1 });
FeedbackSchema.index({ userId: 1, createdAt: -1 });

FeedbackSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

FeedbackSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

FeedbackSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
