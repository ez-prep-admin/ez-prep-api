import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  INSTANCE_CONFIG_ID,
  INSTANCE_CONFIG_SCHEMA_VERSION,
} from '../instance-config.constants';

export type InstanceConfigDocument = InstanceConfig & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'instance_configs',
})
export class InstanceConfig {
  @Prop({ type: String, default: INSTANCE_CONFIG_ID })
  _id: string;

  @Prop({ required: true, default: INSTANCE_CONFIG_SCHEMA_VERSION })
  schemaVersion: number;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 2048 })
  logoUrl?: string;

  @Prop({ trim: true, maxlength: 2048 })
  faviconUrl?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InstanceConfigSchema =
  SchemaFactory.createForClass(InstanceConfig);
