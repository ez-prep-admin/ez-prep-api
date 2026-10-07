import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';

@Schema({ _id: false })
export class ProductGrant {
  @Prop({
    type: String,
    enum: Object.values(EntitlementScopeType),
    required: true,
  })
  scopeType: EntitlementScopeType;

  @Prop({ type: Types.ObjectId, required: true })
  scopeId: Types.ObjectId;
}

export const ProductGrantSchema = SchemaFactory.createForClass(ProductGrant);
