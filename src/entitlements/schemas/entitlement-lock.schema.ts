import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EntitlementLockDocument = EntitlementLock & Document;

@Schema({
  collection: 'entitlement_locks',
  versionKey: false,
  timestamps: false,
})
export class EntitlementLock {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  holder: string;

  @Prop({ type: Date, required: true })
  lockedUntil: Date;
}

export const EntitlementLockSchema =
  SchemaFactory.createForClass(EntitlementLock);

EntitlementLockSchema.index({ lockedUntil: 1 }, { expireAfterSeconds: 0 });
