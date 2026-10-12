import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AwsConfigService } from '../aws/config/aws.config';
import { S3Service } from '../aws/s3/s3.service';
import { supplyTypeFromSnapshot } from '../common/commerce/calculate-inclusive-tax';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { TaxInvoiceStatus } from '../common/enums/tax-invoice-status.enum';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { INSTANCE_CONFIG_ID } from '../instance-config/instance-config.constants';
import {
  InstanceConfig,
  InstanceConfigDocument,
} from '../instance-config/schemas/instance-config.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  formatInvoiceNumber,
  indianFinancialYearLabel,
  invoicePdfFilename,
} from './invoice-format';
import { TaxInvoicePdfModel } from './pdf/tax-invoice-pdf.model';
import { TaxInvoice, TaxInvoiceDocument } from './schemas/tax-invoice.schema';

export type IssueInvoiceResult = {
  invoiceId: string;
  invoiceNumber: string;
  alreadyIssued: boolean;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  status: TaxInvoiceStatus;
  issuedAt: Date;
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxRate: number;
};

export type InvoicePdfDownload = {
  body: Buffer;
  filename: string;
};

export type TaxInvoicePdfRenderer = (
  model: TaxInvoicePdfModel,
) => Promise<Buffer>;

export const TAX_INVOICE_PDF_RENDERER = 'TAX_INVOICE_PDF_RENDERER';

/**
 * Issues one B2C tax invoice per paid order.
 * Tax amounts are copied from the order. Seller and SAC are snapshotted
 * from instance config at issue time and are not rewritten later.
 * TODO(golive): U-GST-07 — no IRN / e-invoice integration in v1.
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectModel(TaxInvoice.name)
    private readonly invoiceModel: Model<TaxInvoiceDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(InstanceConfig.name)
    private readonly configModel: Model<InstanceConfigDocument>,
    private readonly s3Service: S3Service,
    private readonly awsConfig: AwsConfigService,
    @Inject(TAX_INVOICE_PDF_RENDERER)
    private readonly renderPdf: TaxInvoicePdfRenderer,
    private readonly commerceAuditService: CommerceAuditService,
  ) {}

  async issueForPaidOrder(orderId: string): Promise<IssueInvoiceResult> {
    const order = await this.requireOrder(orderId);
    const existing = await this.invoiceModel
      .findOne({ orderId: order._id })
      .exec();
    if (existing) {
      await this.ensurePdf(existing);
      return {
        invoiceId: this.idOf(existing),
        invoiceNumber: existing.invoiceNumber,
        alreadyIssued: true,
      };
    }

    this.assertPayable(order);
    const payment = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (!payment || payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Payment is not captured');
    }

    const identity = await this.readCommerceIdentity();
    await this.assertSellerStateMatches(order, identity.seller.stateCode);
    if (!order.paidAt) {
      throw new BadRequestException('Order has no payment date');
    }
    const issuedAt = order.paidAt;
    const invoice = await this.insertInvoice(order, identity, issuedAt);
    await this.ensurePdf(invoice);
    await this.commerceAuditService.log({
      action: 'INVOICE_ISSUED',
      resourceType: 'invoice',
      resourceId: this.idOf(invoice),
      after: {
        invoiceNumber: invoice.invoiceNumber,
        orderId: this.idOf(order),
      },
    });
    this.logger.log(
      `Issued invoice ${invoice.invoiceNumber} for order ${this.idOf(order)}`,
    );
    return {
      invoiceId: this.idOf(invoice),
      invoiceNumber: invoice.invoiceNumber,
      alreadyIssued: false,
    };
  }

  async listForUser(userId: string): Promise<InvoiceSummary[]> {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }
    const rows = await this.invoiceModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ issuedAt: -1 })
      .exec();
    return rows.map(row => this.toSummary(row));
  }

  async listForAdmin(options?: { page?: number; limit?: number }): Promise<{
    data: InvoiceSummary[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = positivePage(options?.page, 1);
    const limit = Math.min(positivePage(options?.limit, 50), 100);
    const filter = {};
    const [rows, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .sort({ issuedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.invoiceModel.countDocuments(filter).exec(),
    ]);
    return {
      data: rows.map(row => this.toSummary(row)),
      meta: { page, limit, total },
    };
  }

  async distinctOrderIds(): Promise<Types.ObjectId[]> {
    return this.invoiceModel.distinct('orderId').exec();
  }

  async repairState(
    orderId: string,
  ): Promise<'missing' | 'needs-pdf' | 'ready'> {
    if (!Types.ObjectId.isValid(orderId)) {
      return 'missing';
    }
    const invoice = await this.invoiceModel
      .findOne({ orderId: new Types.ObjectId(orderId) })
      .exec();
    if (!invoice) {
      return 'missing';
    }
    if (!invoice.pdfStorageKey) {
      return 'needs-pdf';
    }
    return 'ready';
  }

  async ensureStoredPdf(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) {
      return;
    }
    const invoice = await this.invoiceModel
      .findOne({ orderId: new Types.ObjectId(orderId) })
      .exec();
    if (!invoice) {
      return;
    }
    await this.ensurePdf(invoice);
  }

  async findByOrderId(orderId: string): Promise<InvoiceSummary | null> {
    if (!Types.ObjectId.isValid(orderId)) {
      return null;
    }
    const invoice = await this.invoiceModel
      .findOne({ orderId: new Types.ObjectId(orderId) })
      .exec();
    return invoice ? this.toSummary(invoice) : null;
  }

  async downloadForUser(
    invoiceId: string,
    userId: string,
  ): Promise<InvoicePdfDownload> {
    const invoice = await this.findVisible(invoiceId);
    if (String(invoice.userId) !== userId) {
      throw new NotFoundException('Invoice not found');
    }
    return this.readPdf(invoice);
  }

  async downloadForAdmin(invoiceId: string): Promise<InvoicePdfDownload> {
    const invoice = await this.findVisible(invoiceId);
    return this.readPdf(invoice);
  }

  private async requireOrder(orderId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private assertPayable(order: OrderDocument): void {
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Order is not paid');
    }
  }

  private async readCommerceIdentity(): Promise<CommerceIdentity> {
    const config = await this.configModel.findById(INSTANCE_CONFIG_ID).exec();
    const seller = config?.seller;
    const tax = config?.taxConfig;
    if (
      !seller?.legalName ||
      !seller.gstin ||
      !seller.registeredAddress ||
      !seller.state ||
      !seller.stateCode ||
      !tax?.sacCode ||
      !tax.sacDescription ||
      !tax.invoiceSeriesPrefix
    ) {
      throw new BadRequestException(
        'Seller and tax configuration is incomplete. Seed instance config before issuing invoices.',
      );
    }
    return {
      seller: {
        legalName: seller.legalName,
        gstin: seller.gstin,
        registeredAddress: seller.registeredAddress,
        state: seller.state,
        stateCode: seller.stateCode,
        ...(seller.signatoryName
          ? { signatoryName: seller.signatoryName }
          : {}),
        ...(seller.signatoryDesignation
          ? { signatoryDesignation: seller.signatoryDesignation }
          : {}),
      },
      sacCode: tax.sacCode,
      sacDescription: tax.sacDescription,
      invoiceSeriesPrefix: tax.invoiceSeriesPrefix,
    };
  }

  /**
   * A GSTIN or seller-state change after payment must not produce an invoice
   * whose tax split was priced in a different state. Old orders have no
   * snapshotted seller state and still issue.
   */
  private async assertSellerStateMatches(
    order: OrderDocument,
    liveStateCode: string,
  ): Promise<void> {
    const snapshotted = order.tax.sellerStateCode?.trim();
    if (!snapshotted || snapshotted === liveStateCode) {
      return;
    }
    await this.commerceAuditService.log({
      action: 'INVOICE_SELLER_STATE_MISMATCH',
      resourceType: 'order',
      resourceId: this.idOf(order),
      after: {
        orderSellerStateCode: snapshotted,
        liveSellerStateCode: liveStateCode,
      },
    });
    throw new BadRequestException(
      'Invoice cannot be issued because the seller state changed after payment.',
    );
  }

  private async insertInvoice(
    order: OrderDocument,
    identity: CommerceIdentity,
    issuedAt: Date,
  ): Promise<TaxInvoiceDocument> {
    const financialYear = indianFinancialYearLabel(issuedAt);
    const prefix = identity.invoiceSeriesPrefix;
    const draft = {
      orderId: order._id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      status: TaxInvoiceStatus.ISSUED,
      billing: {
        name: order.billing.name,
        state: order.billing.state,
        stateCode: order.billing.stateCode,
        addressLine1: order.billing.addressLine1,
        ...(order.billing.addressLine2
          ? { addressLine2: order.billing.addressLine2 }
          : {}),
        city: order.billing.city,
        pincode: order.billing.pincode,
      },
      seller: identity.seller,
      sacCode: identity.sacCode,
      sacDescription: identity.sacDescription,
      invoiceSeriesPrefix: prefix,
      financialYear,
      lineItems: order.items.map(item => ({
        description: `${item.productName} (${item.durationPreset})`,
        amount: item.amount,
      })),
      tax: {
        grossAmount: order.tax.grossAmount,
        taxableAmount: order.tax.taxableAmount,
        taxAmount: order.tax.taxAmount,
        cgst: order.tax.cgst,
        sgst: order.tax.sgst,
        igst: order.tax.igst,
        taxRate: order.tax.taxRate,
        supplyType: supplyTypeFromSnapshot(order.tax),
        ...(order.tax.sellerStateCode
          ? { sellerStateCode: order.tax.sellerStateCode }
          : {}),
        ...(order.tax.buyerStateCode
          ? { buyerStateCode: order.tax.buyerStateCode }
          : {}),
      },
      issuedAt,
    };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const sequence = await this.nextSequence(prefix, financialYear);
      const invoiceNumber = formatInvoiceNumber(
        prefix,
        financialYear,
        sequence,
      );
      try {
        return await this.invoiceModel.create({
          ...draft,
          sequence,
          invoiceNumber,
        });
      } catch (error: unknown) {
        const field = duplicateField(error);
        if (field === 'orderId') {
          const existing = await this.invoiceModel
            .findOne({ orderId: order._id })
            .exec();
          if (existing) {
            return existing;
          }
        }
        if (field === 'invoiceNumber') {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Could not allocate an invoice number');
  }

  private async nextSequence(
    prefix: string,
    financialYear: string,
  ): Promise<number> {
    const latest = await this.invoiceModel
      .findOne({ invoiceSeriesPrefix: prefix, financialYear })
      .sort({ sequence: -1 })
      .exec();
    return (latest?.sequence ?? 0) + 1;
  }

  private async ensurePdf(invoice: TaxInvoiceDocument): Promise<void> {
    if (invoice.pdfStorageKey) {
      return;
    }
    const body = await this.renderPdf(toPdfModel(invoice));
    const bucket = this.awsConfig.s3InvoicesBucket;
    const key = this.s3Service.generateGstInvoiceKey(
      String(invoice.userId),
      String(invoice.orderId),
    );
    await this.s3Service.uploadFile(body, {
      bucket,
      key,
      contentType: 'application/pdf',
    });
    invoice.pdfStorageKey = key;
    invoice.pdfStorageBucket = bucket;
    await invoice.save();
  }

  private async findVisible(invoiceId: string): Promise<TaxInvoiceDocument> {
    if (!Types.ObjectId.isValid(invoiceId)) {
      throw new NotFoundException('Invoice not found');
    }
    const invoice = await this.invoiceModel.findById(invoiceId).exec();
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  private async readPdf(
    invoice: TaxInvoiceDocument,
  ): Promise<InvoicePdfDownload> {
    if (!invoice.pdfStorageKey) {
      throw new NotFoundException('Invoice PDF is not available');
    }
    const downloaded = await this.s3Service.downloadFile(
      invoice.pdfStorageKey,
      invoice.pdfStorageBucket || this.awsConfig.s3InvoicesBucket,
    );
    return {
      body: downloaded.body,
      filename: invoicePdfFilename(invoice.invoiceNumber),
    };
  }

  private toSummary(invoice: TaxInvoiceDocument): InvoiceSummary {
    return {
      id: this.idOf(invoice),
      invoiceNumber: invoice.invoiceNumber,
      orderId: String(invoice.orderId),
      orderNumber: invoice.orderNumber,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      grossAmount: invoice.tax.grossAmount,
      taxableAmount: invoice.tax.taxableAmount,
      taxAmount: invoice.tax.taxAmount,
      cgst: invoice.tax.cgst,
      sgst: invoice.tax.sgst,
      igst: invoice.tax.igst,
      taxRate: invoice.tax.taxRate,
    };
  }

  private idOf(doc: { _id: Types.ObjectId; id?: string }): string {
    return doc.id ?? String(doc._id);
  }
}

type CommerceIdentity = {
  seller: TaxInvoicePdfModel['seller'];
  sacCode: string;
  sacDescription: string;
  invoiceSeriesPrefix: string;
};

function positivePage(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}

function toPdfModel(invoice: TaxInvoice): TaxInvoicePdfModel {
  return {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    orderNumber: invoice.orderNumber,
    billing: {
      name: invoice.billing.name,
      state: invoice.billing.state,
      stateCode: invoice.billing.stateCode,
      addressLine1: invoice.billing.addressLine1,
      addressLine2: invoice.billing.addressLine2,
      city: invoice.billing.city,
      pincode: invoice.billing.pincode,
    },
    seller: {
      legalName: invoice.seller.legalName,
      gstin: invoice.seller.gstin,
      registeredAddress: invoice.seller.registeredAddress,
      state: invoice.seller.state,
      stateCode: invoice.seller.stateCode,
      signatoryName: invoice.seller.signatoryName,
      signatoryDesignation: invoice.seller.signatoryDesignation,
    },
    sacCode: invoice.sacCode,
    sacDescription: invoice.sacDescription,
    lineItems: invoice.lineItems.map(line => ({
      description: line.description,
      amount: line.amount,
    })),
    tax: {
      grossAmount: invoice.tax.grossAmount,
      taxableAmount: invoice.tax.taxableAmount,
      taxAmount: invoice.tax.taxAmount,
      cgst: invoice.tax.cgst,
      sgst: invoice.tax.sgst,
      igst: invoice.tax.igst,
      taxRate: invoice.tax.taxRate,
      ...(invoice.tax.supplyType ? { supplyType: invoice.tax.supplyType } : {}),
    },
  };
}

function duplicateField(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  if ((error as { code?: unknown }).code !== 11000) {
    return null;
  }
  const keyPattern = (error as { keyPattern?: Record<string, unknown> })
    .keyPattern;
  if (!keyPattern) {
    return null;
  }
  return Object.keys(keyPattern)[0] ?? null;
}
