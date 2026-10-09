import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  INSTANCE_CONFIG_ID,
  INSTANCE_CONFIG_SCHEMA_VERSION,
} from '../instance-config.constants';

export type InstanceConfigDocument = InstanceConfig & Document;

/**
 * Commerce tax settings. Values come from the database seed, not from code.
 * Owner confirmed 18% and SAC 999293 on 2026-10-09. Change them in config, not in code.
 */
@Schema({ _id: false })
export class InstanceTaxConfig {
  @Prop({ type: Boolean })
  taxEnabled?: boolean;

  @Prop({ trim: true })
  taxType?: string;

  /** Percent, e.g. 18. Not a per-offer field. */
  @Prop({ type: Number })
  taxRate?: number;

  @Prop({ type: Boolean })
  pricesAreTaxInclusive?: boolean;

  @Prop({ trim: true })
  currency?: string;

  @Prop({ trim: true })
  sacCode?: string;

  @Prop({ trim: true })
  sacDescription?: string;

  @Prop({ trim: true })
  invoiceSeriesPrefix?: string;
}

export const InstanceTaxConfigSchema =
  SchemaFactory.createForClass(InstanceTaxConfig);

/** Seller identity for tax snapshots. Production values are U-OPS-01. */
@Schema({ _id: false })
export class InstanceSeller {
  @Prop({ trim: true })
  legalName?: string;

  @Prop({ trim: true })
  gstin?: string;

  @Prop({ trim: true })
  registeredAddress?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  stateCode?: string;
}

export const InstanceSellerSchema =
  SchemaFactory.createForClass(InstanceSeller);

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

  /** Optional until a local/prod commerce seed writes it. Phase 10 owns admin edits. */
  @Prop({ type: InstanceTaxConfigSchema })
  taxConfig?: InstanceTaxConfig;

  /** Optional until a local/prod commerce seed writes it. Phase 10 owns admin edits. */
  @Prop({ type: InstanceSellerSchema })
  seller?: InstanceSeller;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InstanceConfigSchema =
  SchemaFactory.createForClass(InstanceConfig);
