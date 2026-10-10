import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const WEBHOOK_DELIVERY_STAT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SIGNATURE_REJECTION_DEGRADED_THRESHOLD = 5;

export type WebhookDeliveryStatDocument = WebhookDeliveryStat & Document;

/** Hourly signature-rejection counter. `_id` is `rejected:<UTC hour>`. */
@Schema({
  collection: 'webhook_delivery_stats',
  versionKey: false,
  timestamps: { createdAt: false, updatedAt: true },
})
export class WebhookDeliveryStat {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Number, required: true, default: 0 })
  count: number;

  updatedAt?: Date;
}

export const WebhookDeliveryStatSchema =
  SchemaFactory.createForClass(WebhookDeliveryStat);

WebhookDeliveryStatSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: WEBHOOK_DELIVERY_STAT_TTL_SECONDS },
);

/** `rejected:2026-10-11T18` in UTC. */
export function webhookRejectionHourId(now: Date): string {
  return `rejected:${now.toISOString().slice(0, 13)}`;
}

export function webhookRejectionHourIds(now: Date, hours: number): string[] {
  const ids: string[] = [];
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let offset = 0; offset < hours; offset += 1) {
    const hour = new Date(start.getTime() - offset * 60 * 60 * 1000);
    ids.push(webhookRejectionHourId(hour));
  }
  return ids;
}
