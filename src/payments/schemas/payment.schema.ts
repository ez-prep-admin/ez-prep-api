import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

export type PaymentDocument = Payment & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'payments',
})
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  provider: string;

  @Prop({ trim: true })
  providerPaymentId?: string;

  @Prop({ trim: true })
  providerOrderId?: string;

  /** Integer paise */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ required: true, default: 'INR', trim: true })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
  })
  status: PaymentStatus;

  @Prop({ trim: true })
  method?: string;

  @Prop({ trim: true })
  failureCode?: string;

  @Prop({ trim: true })
  failureReason?: string;

  @Prop({ trim: true })
  rawStatus?: string;

  @Prop({ type: Date })
  capturedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    name: 'provider_1_providerPaymentId',
    partialFilterExpression: {
      providerPaymentId: { $type: 'string', $gt: '' },
    },
  },
);
PaymentSchema.index({ providerOrderId: 1 });
PaymentSchema.index({ status: 1 });

PaymentSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

PaymentSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

PaymentSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
