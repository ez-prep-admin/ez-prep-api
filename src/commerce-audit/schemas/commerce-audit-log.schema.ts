import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommerceAuditLogDocument = CommerceAuditLog & Document;

/**
 * Minimal commerce audit skeleton (phase 02).
 * Full audit APIs / reconciliation productization: phase 12.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  collection: 'commerce_audit_logs',
})
export class CommerceAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  actorUserId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  action: string;

  @Prop({ required: true, trim: true, index: true })
  resourceType: string;

  @Prop({ type: Types.ObjectId, index: true })
  resourceId?: Types.ObjectId;

  @Prop({ type: Object })
  before?: Record<string, unknown>;

  @Prop({ type: Object })
  after?: Record<string, unknown>;

  @Prop({ trim: true })
  correlationId?: string;

  createdAt?: Date;
}

export const CommerceAuditLogSchema =
  SchemaFactory.createForClass(CommerceAuditLog);

CommerceAuditLogSchema.index({ action: 1, createdAt: -1 });
CommerceAuditLogSchema.index({ resourceType: 1, resourceId: 1 });

CommerceAuditLogSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

CommerceAuditLogSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

CommerceAuditLogSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
