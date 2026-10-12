import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TaxInvoiceStatus } from '../../common/enums/tax-invoice-status.enum';
import {
  OrderBillingSnapshot,
  OrderBillingSnapshotSchema,
  OrderTaxSnapshot,
  OrderTaxSnapshotSchema,
} from '../../orders/schemas/order.schema';

@Schema({ _id: false })
export class InvoiceSellerSnapshot {
  @Prop({ required: true, trim: true })
  legalName: string;

  @Prop({ required: true, trim: true })
  gstin: string;

  @Prop({ required: true, trim: true })
  registeredAddress: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true })
  stateCode: string;

  @Prop({ trim: true })
  signatoryName?: string;

  @Prop({ trim: true })
  signatoryDesignation?: string;
}

export const InvoiceSellerSnapshotSchema = SchemaFactory.createForClass(
  InvoiceSellerSnapshot,
);

@Schema({ _id: false })
export class InvoiceLineItem {
  @Prop({ required: true, trim: true })
  description: string;

  /** Inclusive amount in paise. */
  @Prop({ type: Number, required: true })
  amount: number;
}

export const InvoiceLineItemSchema =
  SchemaFactory.createForClass(InvoiceLineItem);

export type TaxInvoiceDocument = TaxInvoice & Document;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'tax_invoices',
})
export class TaxInvoice {
  @Prop({ required: true, trim: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  orderNumber: string;

  @Prop({
    type: String,
    enum: Object.values(TaxInvoiceStatus),
    required: true,
  })
  status: TaxInvoiceStatus;

  @Prop({ type: OrderBillingSnapshotSchema, required: true })
  billing: OrderBillingSnapshot;

  @Prop({ type: InvoiceSellerSnapshotSchema, required: true })
  seller: InvoiceSellerSnapshot;

  @Prop({ required: true, trim: true })
  sacCode: string;

  @Prop({ required: true, trim: true })
  sacDescription: string;

  @Prop({ required: true, trim: true })
  invoiceSeriesPrefix: string;

  @Prop({ required: true, trim: true })
  financialYear: string;

  @Prop({ type: Number, required: true })
  sequence: number;

  @Prop({ type: [InvoiceLineItemSchema], required: true })
  lineItems: InvoiceLineItem[];

  @Prop({ type: OrderTaxSnapshotSchema, required: true })
  tax: OrderTaxSnapshot;

  @Prop({ type: Date, required: true })
  issuedAt: Date;

  @Prop({ trim: true })
  pdfStorageKey?: string;

  /** Bucket the PDF was written to. Downloads use this, not the live env name. */
  @Prop({ trim: true })
  pdfStorageBucket?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TaxInvoiceSchema = SchemaFactory.createForClass(TaxInvoice);

TaxInvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
TaxInvoiceSchema.index({ orderId: 1 }, { unique: true });
TaxInvoiceSchema.index({ userId: 1, issuedAt: -1 });
TaxInvoiceSchema.index({
  invoiceSeriesPrefix: 1,
  financialYear: 1,
  sequence: -1,
});

TaxInvoiceSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

TaxInvoiceSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
