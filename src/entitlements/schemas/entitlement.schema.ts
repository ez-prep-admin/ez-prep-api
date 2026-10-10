import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';
import { EntitlementSourceType } from '../../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../../common/enums/entitlement-status.enum';

export type EntitlementDocument = Entitlement & Document;

/**
 * Commerce entitlement — source of truth for content access (D-06).
 * Do not use User.subscription for authorization (R-13).
 */
@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'entitlements',
})
export class Entitlement {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(EntitlementScopeType),
    required: true,
    index: true,
  })
  scopeType: EntitlementScopeType;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  scopeId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(EntitlementStatus),
    required: true,
    default: EntitlementStatus.ACTIVE,
    index: true,
  })
  status: EntitlementStatus;

  @Prop({ required: true })
  startsAt: Date;

  /** null = lifetime */
  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({
    type: String,
    enum: Object.values(EntitlementSourceType),
    required: true,
  })
  sourceType: EntitlementSourceType;

  @Prop({ trim: true })
  sourceId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop({ type: Number })
  productVersion?: number;

  @Prop({ type: Types.ObjectId })
  orderId?: Types.ObjectId;

  /** Preset copied from the paid order item. Used to recompute a window. */
  @Prop({ type: String, enum: Object.values(DurationPreset) })
  durationPreset?: DurationPreset;

  /** Unique idempotency key for provision / admin grant */
  @Prop({ required: true, unique: true, trim: true })
  provisioningKey: string;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop({ trim: true })
  revokeReason?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EntitlementSchema = SchemaFactory.createForClass(Entitlement);

EntitlementSchema.index({
  userId: 1,
  status: 1,
  scopeType: 1,
  scopeId: 1,
});
EntitlementSchema.index({ userId: 1, productId: 1, status: 1 });
EntitlementSchema.index({ userId: 1, status: 1, expiresAt: 1 });
EntitlementSchema.index({ expiresAt: 1 });

EntitlementSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

EntitlementSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

EntitlementSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
