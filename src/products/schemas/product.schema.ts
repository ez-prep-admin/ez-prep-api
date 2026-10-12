import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query, Types } from 'mongoose';
import { ProductStatus } from '../../common/enums/product-status.enum';
import { ProductGrant, ProductGrantSchema } from './product-grant.schema';

export type ProductDocument = Product & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'products',
})
export class Product {
  @Prop({ required: true, trim: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(ProductStatus),
    required: true,
    default: ProductStatus.DRAFT,
    index: true,
  })
  status: ProductStatus;

  /** 0 until first publish; then 1, 2, … */
  @Prop({ type: Number, required: true, default: 0 })
  version: number;

  @Prop({ type: [ProductGrantSchema], default: [] })
  grants: ProductGrant[];

  /** Frozen grants from the last publish. Absent until backfill or publish. */
  @Prop({ type: [ProductGrantSchema] })
  publishedGrants?: ProductGrant[];

  @Prop({ type: Object })
  display?: Record<string, unknown>;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ 'grants.scopeType': 1, 'grants.scopeId': 1 });
ProductSchema.index({
  'publishedGrants.scopeType': 1,
  'publishedGrants.scopeId': 1,
});
ProductSchema.index({ status: 1, isDeleted: 1 });

ProductSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

ProductSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ProductSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ProductSchema.pre(/^find/, function (this: Query<unknown, ProductDocument>) {
  this.where({ isDeleted: { $ne: true } });
});
