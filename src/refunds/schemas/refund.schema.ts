import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RefundStatus } from '../../common/enums/refund-status.enum';
import { RefundKind } from '../domain/refund-kind.enum';

export type RefundDocument = Refund & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'refunds',
})
export class Refund {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true })
  paymentId: Types.ObjectId;

  /** ORDER refunds the purchase. DUPLICATE_CAPTURE is reserved for phase 14C. */
  @Prop({
    type: String,
    enum: Object.values(RefundKind),
    required: true,
    default: RefundKind.ORDER,
  })
  kind: RefundKind;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  provider: string;

  @Prop({ trim: true })
  providerRefundId?: string;

  /** Full payment amount in paise. */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({
    type: String,
    enum: Object.values(RefundStatus),
    required: true,
  })
  status: RefundStatus;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  initiatedBy: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);

RefundSchema.index({ orderId: 1 });
RefundSchema.index({ paymentId: 1 }, { unique: true, name: 'paymentId_1' });

RefundSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

RefundSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

RefundSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
