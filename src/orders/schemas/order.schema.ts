import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  GST_SUPPLY_TYPES,
  GstSupplyType,
} from '../../common/commerce/calculate-inclusive-tax';
import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Schema({ _id: false })
export class OrderItemGrant {
  @Prop({
    type: String,
    enum: Object.values(EntitlementScopeType),
    required: true,
  })
  scopeType: EntitlementScopeType;

  @Prop({ type: String, required: true })
  scopeId: string;
}

export const OrderItemGrantSchema =
  SchemaFactory.createForClass(OrderItemGrant);

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  productVersion: number;

  @Prop({ required: true, trim: true })
  productCode: string;

  @Prop({ required: true, trim: true })
  productName: string;

  @Prop({ type: Types.ObjectId, ref: 'Offer', required: true })
  offerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DurationPreset),
    required: true,
  })
  durationPreset: DurationPreset;

  /** Inclusive list price in paise at purchase. */
  @Prop({ type: Number, required: true })
  listAmount: number;

  /** Inclusive amount charged for this item, in paise. */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: [OrderItemGrantSchema], default: [] })
  grants: OrderItemGrant[];
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class OrderTaxSnapshot {
  @Prop({ type: Number, required: true })
  grossAmount: number;

  @Prop({ type: Number, required: true })
  taxableAmount: number;

  @Prop({ type: Number, required: true })
  taxAmount: number;

  @Prop({ type: Number, required: true })
  cgst: number;

  @Prop({ type: Number, required: true })
  sgst: number;

  @Prop({ type: Number, required: true })
  igst: number;

  @Prop({ type: Number, required: true })
  taxRate: number;

  /** Absent on orders created before phase 14E. */
  @Prop({ type: String, enum: GST_SUPPLY_TYPES })
  supplyType?: GstSupplyType;

  @Prop({ trim: true })
  sellerStateCode?: string;

  @Prop({ trim: true })
  buyerStateCode?: string;
}

export const OrderTaxSnapshotSchema =
  SchemaFactory.createForClass(OrderTaxSnapshot);

@Schema({ _id: false })
export class OrderBillingSnapshot {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true })
  stateCode: string;

  @Prop({ required: true, trim: true })
  addressLine1: string;

  @Prop({ trim: true })
  addressLine2?: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  pincode: string;
}

export const OrderBillingSnapshotSchema =
  SchemaFactory.createForClass(OrderBillingSnapshot);

export type OrderDocument = Order & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'orders',
})
export class Order {
  @Prop({ required: true, trim: true })
  orderNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    required: true,
  })
  status: OrderStatus;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  /** Charged inclusive amount in paise. */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ required: true, default: 'INR', trim: true })
  currency: string;

  @Prop({ type: OrderTaxSnapshotSchema, required: true })
  tax: OrderTaxSnapshot;

  @Prop({ type: OrderBillingSnapshotSchema, required: true })
  billing: OrderBillingSnapshot;

  @Prop({ trim: true })
  paymentProvider?: string;

  @Prop({ trim: true })
  providerOrderId?: string;

  @Prop({ required: true, trim: true })
  idempotencyKey: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  /**
   * Set after snapshot grants have been provisioned.
   * Unset on a PAID order means repair is still required.
   */
  @Prop({ type: Date })
  provisionedAt?: Date;

  /** Set when a paid order was already covered for life at provisioning. */
  @Prop({ type: Boolean })
  redundantPurchase?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ idempotencyKey: 1 }, { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, status: 1, createdAt: 1 });
OrderSchema.index({ status: 1, createdAt: 1 });
OrderSchema.index({ providerOrderId: 1 });

OrderSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

OrderSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

OrderSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
