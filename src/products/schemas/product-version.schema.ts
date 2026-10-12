import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProductGrant, ProductGrantSchema } from './product-grant.schema';

export type ProductVersionDocument = ProductVersion & Document;

/**
 * Immutable snapshot of a product at publish time (Option B / R-07).
 * Never update documents in this collection after insert.
 */
@Schema({
  timestamps: false,
  versionKey: false,
  collection: 'product_versions',
})
export class ProductVersion {
  @Prop({
    type: Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  })
  productId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  version: number;

  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [ProductGrantSchema], default: [] })
  grants: ProductGrant[];

  @Prop({ type: Date, required: true })
  frozenAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  publishedBy?: Types.ObjectId;
}

export const ProductVersionSchema =
  SchemaFactory.createForClass(ProductVersion);

ProductVersionSchema.index({ productId: 1, version: 1 }, { unique: true });

ProductVersionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

ProductVersionSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ProductVersionSchema.set('toObject', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
