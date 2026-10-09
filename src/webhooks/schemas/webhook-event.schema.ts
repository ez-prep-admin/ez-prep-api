import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WebhookEventStatus } from '../../common/enums/webhook-event-status.enum';

export type WebhookEventDocument = WebhookEvent & Document;

@Schema({
  timestamps: false,
  versionKey: false,
  collection: 'webhook_events',
})
export class WebhookEvent {
  @Prop({ required: true, trim: true })
  provider: string;

  @Prop({ required: true, trim: true })
  providerEventId: string;

  @Prop({ required: true, trim: true })
  eventType: string;

  @Prop({
    type: String,
    enum: Object.values(WebhookEventStatus),
    required: true,
  })
  status: WebhookEventStatus;

  @Prop({ required: true, trim: true })
  payloadHash: string;

  @Prop({ trim: true })
  error?: string;

  @Prop({ type: Date, required: true })
  receivedAt: Date;

  @Prop({ type: Date })
  processedAt?: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

WebhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });

WebhookEventSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

WebhookEventSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

WebhookEventSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
