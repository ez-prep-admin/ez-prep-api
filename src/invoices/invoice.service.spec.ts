import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AwsConfigService } from '../aws/config/aws.config';
import { S3Service } from '../aws/s3/s3.service';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { INSTANCE_CONFIG_ID } from '../instance-config/instance-config.constants';
import { InstanceConfig } from '../instance-config/schemas/instance-config.schema';
import { Order } from '../orders/schemas/order.schema';
import { Payment } from '../payments/schemas/payment.schema';
import {
  formatInvoiceNumber,
  indianFinancialYearLabel,
} from './invoice-format';
import { InvoiceService, TAX_INVOICE_PDF_RENDERER } from './invoice.service';
import { TaxInvoicePdfModel } from './pdf/tax-invoice-pdf.model';
import { TaxInvoice } from './schemas/tax-invoice.schema';

type Row = Record<string, any>;

describe('InvoiceService', () => {
  const invoices: Row[] = [];
  const orders = new Map<string, Row>();
  const payments: Row[] = [];
  let config: Row;
  let clashOnFirstSequence = false;

  const render = jest.fn(async (_model: TaxInvoicePdfModel) =>
    Buffer.from('%PDF'),
  );
  const s3 = {
    uploadFile: jest.fn(async () => ({ key: 'stored' })),
    downloadFile: jest.fn(),
    generateGstInvoiceKey: jest.fn(
      (userId: string, orderId: string) => `${userId}/${orderId}.pdf`,
    ),
  };
  const awsConfig = { s3InvoicesBucket: 'invoices-bucket' };

  const invoiceModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const orderModel = { findById: jest.fn() };
  const paymentModel = { findOne: jest.fn() };
  const configModel = { findById: jest.fn() };

  let service: InvoiceService;

  beforeEach(async () => {
    invoices.length = 0;
    orders.clear();
    payments.length = 0;
    clashOnFirstSequence = false;
    config = commerceConfig();
    render.mockClear();
    s3.uploadFile.mockReset();
    s3.uploadFile.mockResolvedValue({ key: 'stored' });
    s3.downloadFile.mockReset();

    invoiceModel.findOne.mockImplementation((filter: Row) => ({
      sort() {
        return this;
      },
      exec: async () => highest(invoices.filter(row => matches(row, filter))),
    }));
    invoiceModel.find.mockImplementation((filter: Row = {}) => ({
      sort() {
        return this;
      },
      exec: async () =>
        invoices
          .filter(row => matches(row, filter))
          .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()),
    }));
    invoiceModel.findById.mockImplementation((id: string) => ({
      exec: async () =>
        invoices.find(row => String(row._id) === String(id)) ?? null,
    }));
    invoiceModel.create.mockImplementation(async (doc: Row) => {
      if (clashOnFirstSequence && doc.sequence === 1) {
        clashOnFirstSequence = false;
        invoices.push({
          ...doc,
          _id: new Types.ObjectId(),
          orderId: new Types.ObjectId(),
        });
        throw duplicate('invoiceNumber');
      }
      if (invoices.some(row => row.invoiceNumber === doc.invoiceNumber)) {
        throw duplicate('invoiceNumber');
      }
      if (invoices.some(row => String(row.orderId) === String(doc.orderId))) {
        throw duplicate('orderId');
      }
      const row = {
        ...doc,
        _id: new Types.ObjectId(),
        save: jest.fn(async function save(this: Row) {
          return this;
        }),
      };
      invoices.push(row);
      return row;
    });
    orderModel.findById.mockImplementation((id: string) => ({
      exec: async () => orders.get(String(id)) ?? null,
    }));
    paymentModel.findOne.mockImplementation((filter: Row) => ({
      exec: async () =>
        payments.find(row => String(row.orderId) === String(filter.orderId)) ??
        null,
    }));
    configModel.findById.mockImplementation(() => ({
      exec: async () => config,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: getModelToken(TaxInvoice.name), useValue: invoiceModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        {
          provide: getModelToken(InstanceConfig.name),
          useValue: configModel,
        },
        { provide: S3Service, useValue: s3 },
        { provide: AwsConfigService, useValue: awsConfig },
        { provide: TAX_INVOICE_PDF_RENDERER, useValue: render },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  function seedOrder(
    status = OrderStatus.PAID,
    payment = PaymentStatus.CAPTURED,
  ) {
    const _id = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const order = {
      _id,
      userId,
      orderNumber: `ORD-${_id.toHexString().slice(0, 4)}`,
      status,
      items: [
        {
          productName: 'Kerala Pack',
          durationPreset: DurationPreset.ONE_MONTH,
          amount: 99900,
        },
      ],
      billing: {
        name: 'Ada Buyer',
        state: 'Karnataka',
        stateCode: '29',
        addressLine1: '12 Residency Road',
        city: 'Bengaluru',
        pincode: '560001',
      },
      tax: {
        grossAmount: 99900,
        taxableAmount: 84661,
        taxAmount: 15239,
        cgst: 7619,
        sgst: 7620,
        igst: 0,
        taxRate: 18,
      },
    };
    orders.set(String(_id), order);
    payments.push({ orderId: _id, status: payment });
    return order;
  }

  it('issues only a paid order with a captured payment', async () => {
    const order = seedOrder();

    const issued = await service.issueForPaidOrder(String(order._id));

    expect(issued.alreadyIssued).toBe(false);
    expect(issued.invoiceNumber).toBe(
      formatInvoiceNumber(
        'SERIES',
        indianFinancialYearLabel(invoices[0].issuedAt),
        1,
      ),
    );
    expect(invoices[0].tax).toEqual(order.tax);
    expect(invoices[0].sacCode).toBe('424242');
    expect(invoices[0].seller.gstin).toBe('11PLAINTEXTGSTIN');
    expect(invoices[0].billing.addressLine1).toBe('12 Residency Road');
    expect(configModel.findById).toHaveBeenCalledWith(INSTANCE_CONFIG_ID);
    expect(s3.uploadFile).toHaveBeenCalledWith(expect.any(Buffer), {
      bucket: 'invoices-bucket',
      key: `${String(order.userId)}/${String(order._id)}.pdf`,
      contentType: 'application/pdf',
    });
    expect(invoices[0].pdfStorageBucket).toBe('invoices-bucket');
    expect(render.mock.calls[0][0].seller.gstin).toBe('11PLAINTEXTGSTIN');
    expect(render.mock.calls[0][0].sacCode).toBe('424242');
  });

  it.each([OrderStatus.FAILED, OrderStatus.CANCELLED, OrderStatus.EXPIRED])(
    'rejects a %s order',
    async status => {
      const order = seedOrder(status);

      await expect(
        service.issueForPaidOrder(String(order._id)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(invoices).toHaveLength(0);
      expect(s3.uploadFile).not.toHaveBeenCalled();
    },
  );

  it('rejects a paid order whose payment is not captured', async () => {
    const order = seedOrder(OrderStatus.PAID, PaymentStatus.INITIATED);

    await expect(
      service.issueForPaidOrder(String(order._id)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(invoices).toHaveLength(0);
  });

  it('reuses the same invoice number', async () => {
    const order = seedOrder();
    const first = await service.issueForPaidOrder(String(order._id));
    const second = await service.issueForPaidOrder(String(order._id));

    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect(second.alreadyIssued).toBe(true);
    expect(invoices).toHaveLength(1);
    expect(s3.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('copies the order tax snapshot when live config uses another rate', async () => {
    config.taxConfig.taxRate = 5;
    const order = seedOrder();

    await service.issueForPaidOrder(String(order._id));

    expect(invoices[0].tax).toEqual(order.tax);
    expect(invoices[0].tax.taxRate).toBe(18);
  });

  it('keeps the GSTIN snapshot after config changes', async () => {
    const order = seedOrder();
    const first = await service.issueForPaidOrder(String(order._id));
    config.seller.gstin = '22OTHERENTITYGST';
    config.taxConfig.sacCode = '111111';

    const second = await service.issueForPaidOrder(String(order._id));

    expect(second.invoiceNumber).toBe(first.invoiceNumber);
    expect(invoices[0].seller.gstin).toBe('11PLAINTEXTGSTIN');
    expect(invoices[0].sacCode).toBe('424242');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('retries the PDF upload without a new number', async () => {
    s3.uploadFile.mockRejectedValueOnce(new Error('s3 down'));
    const order = seedOrder();

    await expect(service.issueForPaidOrder(String(order._id))).rejects.toThrow(
      's3 down',
    );
    const number = invoices[0].invoiceNumber;
    expect(invoices[0].pdfStorageKey).toBeUndefined();

    const retried = await service.issueForPaidOrder(String(order._id));

    expect(retried.invoiceNumber).toBe(number);
    expect(retried.alreadyIssued).toBe(true);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].pdfStorageKey).toBe(
      `${String(order.userId)}/${String(order._id)}.pdf`,
    );
    expect(s3.uploadFile).toHaveBeenCalledTimes(2);
  });

  it('allocates the next sequence after an invoice-number clash', async () => {
    clashOnFirstSequence = true;
    const order = seedOrder();

    const issued = await service.issueForPaidOrder(String(order._id));

    expect(issued.invoiceNumber).toBe(
      formatInvoiceNumber(
        'SERIES',
        indianFinancialYearLabel(invoices[1].issuedAt),
        2,
      ),
    );
  });

  it('does not let another user download the PDF', async () => {
    const order = seedOrder();
    const issued = await service.issueForPaidOrder(String(order._id));
    s3.downloadFile.mockResolvedValue({ body: Buffer.from('pdf-bytes') });

    await expect(
      service.downloadForUser(
        issued.invoiceId,
        new Types.ObjectId().toHexString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.downloadFile).not.toHaveBeenCalled();

    const own = await service.downloadForUser(
      issued.invoiceId,
      String(order.userId),
    );
    expect(own.body.toString()).toBe('pdf-bytes');
    expect(own.filename).toBe(
      `${issued.invoiceNumber.replace(/\//g, '-')}.pdf`,
    );
  });

  it('lets an admin download any invoice', async () => {
    const order = seedOrder();
    const issued = await service.issueForPaidOrder(String(order._id));
    s3.downloadFile.mockResolvedValue({ body: Buffer.from('admin-pdf') });

    const file = await service.downloadForAdmin(issued.invoiceId);

    expect(file.body.toString()).toBe('admin-pdf');
    expect(s3.downloadFile).toHaveBeenCalledWith(
      invoices[0].pdfStorageKey,
      'invoices-bucket',
    );
  });

  it('requires seller and SAC from config', async () => {
    delete config.taxConfig.sacCode;
    const order = seedOrder();

    await expect(
      service.issueForPaidOrder(String(order._id)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(invoices).toHaveLength(0);
  });
});

function commerceConfig(): Row {
  return {
    _id: INSTANCE_CONFIG_ID,
    seller: {
      legalName: 'Snapshot Seller LLP',
      gstin: '11PLAINTEXTGSTIN',
      registeredAddress: '1 Harbour Lane',
      state: 'Kerala',
      stateCode: '32',
    },
    taxConfig: {
      taxEnabled: true,
      taxRate: 18,
      sacCode: '424242',
      sacDescription: 'Test coaching services',
      invoiceSeriesPrefix: 'SERIES',
    },
  };
}

function matches(row: Row, filter: Row): boolean {
  if (filter.orderId && String(row.orderId) !== String(filter.orderId)) {
    return false;
  }
  if (
    filter.invoiceSeriesPrefix &&
    row.invoiceSeriesPrefix !== filter.invoiceSeriesPrefix
  ) {
    return false;
  }
  if (filter.financialYear && row.financialYear !== filter.financialYear) {
    return false;
  }
  if (filter.userId && String(row.userId) !== String(filter.userId)) {
    return false;
  }
  return true;
}

function highest(rows: Row[]): Row | null {
  if (rows.length === 0) {
    return null;
  }
  return [...rows].sort((a, b) => b.sequence - a.sequence)[0];
}

function duplicate(field: string): Error & {
  code: number;
  keyPattern: Record<string, number>;
} {
  const error = new Error('E11000') as Error & {
    code: number;
    keyPattern: Record<string, number>;
  };
  error.code = 11000;
  error.keyPattern = { [field]: 1 };
  return error;
}
