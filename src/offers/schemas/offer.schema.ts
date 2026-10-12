import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';

export type OfferDocument = Offer & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'offers',
})
export class Offer {
  @Prop({
    type: Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  })
  productId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DurationPreset),
    required: true,
  })
  durationPreset: DurationPreset;

  @Prop({ required: true, default: 'INR', trim: true })
  currency: string;

  /** Integer paise, GST-inclusive */
  @Prop({ type: Number, required: true })
  listAmount: number;

  /** Integer paise, GST-inclusive */
  @Prop({ type: Number })
  saleAmount?: number;

  @Prop({ type: Boolean, required: true, default: true })
  taxIncluded: boolean;

  @Prop({ type: Date })
  saleValidFrom?: Date;

  @Prop({ type: Date })
  saleValidUntil?: Date;

  @Prop({
    type: String,
    enum: Object.values(OfferStatus),
    required: true,
    default: OfferStatus.ACTIVE,
    index: true,
  })
  status: OfferStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

OfferSchema.index(
  { productId: 1, durationPreset: 1 },
  {
    unique: true,
    partialFilterExpression: { status: OfferStatus.ACTIVE },
  },
);

OfferSchema.index({ productId: 1, status: 1 });

OfferSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

OfferSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

OfferSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
