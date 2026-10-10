import { BadGatewayException, ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { TaxInvoiceStatus } from '../common/enums/tax-invoice-status.enum';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { InvoiceService } from '../invoices/invoice.service';
import { ORDER_PAID_HANDLER } from '../orders/domain/order-paid-handler';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/schemas/order.schema';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { Payment } from '../payments/schemas/payment.schema';
import { User } from '../users/schemas/user.schema';
import {
  REFUND_COMPLETED_MESSAGE,
  REFUND_PENDING_MESSAGE,
  RefundsService,
} from './refunds.service';
import { Refund } from './schemas/refund.schema';
import { memoryFindOneAndUpdate } from '../orders/testing/memory-documents';

type Row = Record<string, any>;

describe('RefundsService', () => {
  const orders: Row[] = [];
  const payments: Row[] = [];
  const refunds: Row[] = [];
  const users: Row[] = [];
  const invoice = {
    status: TaxInvoiceStatus.ISSUED,
    id: 'inv1',
    invoiceNumber: 'EZ/1',
  };
  const gateway = {
    refund: jest.fn(),
    fetchRefundStatus: jest.fn(),
    listRefunds: jest.fn(),
  };
  const entitlements = { revokePaymentEntitlementsForOrder: jest.fn() };
  const audit = { log: jest.fn() };
  const invoices = { findByOrderId: jest.fn() };

  const orderModel = {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const paymentModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const refundModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const userModel = { find: jest.fn() };

  let service: RefundsService;
  const adminId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    orders.length = 0;
    payments.length = 0;
    refunds.length = 0;
    users.length = 0;
    invoice.status = TaxInvoiceStatus.ISSUED;
    gateway.refund.mockReset();
    gateway.listRefunds.mockReset();
    gateway.listRefunds.mockResolvedValue([]);
    entitlements.revokePaymentEntitlementsForOrder.mockReset();
    entitlements.revokePaymentEntitlementsForOrder.mockResolvedValue(undefined);
    audit.log.mockReset();
    audit.log.mockResolvedValue(undefined);
    invoices.findByOrderId.mockReset();
    invoices.findByOrderId.mockImplementation(async () => invoice);

    orderModel.findById.mockImplementation((id: string) => ({
      exec: async () =>
        orders.find(
          row => row.id === String(id) || String(row._id) === String(id),
        ) ?? null,
    }));
    orderModel.find.mockImplementation(() => ({
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      exec: async () => orders,
    }));
    orderModel.countDocuments.mockImplementation(() => ({
      exec: async () => orders.length,
    }));
    paymentModel.findOne.mockImplementation((filter: { orderId: unknown }) => ({
      exec: async () =>
        payments.find(row => String(row.orderId) === String(filter.orderId)) ??
        null,
    }));
    refundModel.findOne.mockImplementation(
      (filter: Record<string, unknown>) => ({
        exec: async () =>
          refunds.find(row =>
            Object.entries(filter).every(
              ([key, value]) => String(row[key]) === String(value),
            ),
          ) ?? null,
      }),
    );
    paymentModel.find.mockImplementation(() => ({
      limit() {
        return this;
      },
      exec: async () => [],
    }));
    paymentModel.findById.mockImplementation(() => ({
      exec: async () => null,
    }));
    refundModel.find.mockImplementation(
      (filter: {
        status?: string;
        updatedAt?: { $lt?: Date };
        outcomeUnknownAt?: unknown;
        providerRefundId?: unknown;
      }) => ({
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        exec: async () =>
          refunds.filter(row => {
            if (filter.status && row.status !== filter.status) {
              return false;
            }
            if (filter.outcomeUnknownAt) {
              return Boolean(row.outcomeUnknownAt);
            }
            if (
              filter.updatedAt?.$lt &&
              (!(row.updatedAt instanceof Date) ||
                !(row.updatedAt < filter.updatedAt.$lt))
            ) {
              return false;
            }
            return Boolean(row.providerRefundId);
          }),
      }),
    );
    userModel.find.mockImplementation(() => ({
      select() {
        return this;
      },
      exec: async () => users,
    }));
    refundModel.create.mockImplementation(async (doc: Row) => {
      const _id = new Types.ObjectId();
      const row: Row = {
        ...doc,
        _id,
        id: _id.toHexString(),
        save: jest.fn(async function save(this: Row) {
          return this;
        }),
      };
      refunds.push(row);
      return row;
    });
    refundModel.findOneAndUpdate.mockImplementation((filter, update) => ({
      exec: async () => memoryFindOneAndUpdate(refunds, filter, update),
    }));
    orderModel.findOneAndUpdate.mockImplementation((filter, update) => ({
      exec: async () => memoryFindOneAndUpdate(orders, filter, update),
    }));
    paymentModel.findOneAndUpdate.mockImplementation((filter, update) => ({
      exec: async () => memoryFindOneAndUpdate(payments, filter, update),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Refund.name), useValue: refundModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: InvoiceService, useValue: invoices },
        { provide: CommerceAuditService, useValue: audit },
        {
          provide: CommerceConfigService,
          useValue: {
            settings: { refundUnknownWindowMinutes: 60, nodeEnv: 'test' },
          },
        },
        {
          provide: PaymentGatewayRegistry,
          useValue: { get: () => gateway },
        },
        { provide: ORDER_PAID_HANDLER, useValue: { onOrderPaid: jest.fn() } },
        {
          provide: EntitlementProvisioningService,
          useValue: { provisionForPaidOrder: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(RefundsService);
  });

  function seedPaid() {
    const _id = new Types.ObjectId();
    const order: Row = {
      _id,
      id: _id.toHexString(),
      orderNumber: 'ORD-1001',
      userId: new Types.ObjectId(),
      status: OrderStatus.PAID,
      amount: 99900,
      currency: 'INR',
      paymentProvider: 'fake',
      items: [],
      tax: { grossAmount: 99900 },
      billing: { name: 'Ada' },
      save: jest.fn(async function save(this: Row) {
        return this;
      }),
    };
    orders.push(order);
    payments.push({
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toHexString(),
      orderId: _id,
      provider: 'fake',
      providerPaymentId: 'pay_1',
      amount: 99900,
      currency: 'INR',
      status: PaymentStatus.CAPTURED,
      save: jest.fn(async function save(this: Row) {
        return this;
      }),
    });
    return order;
  }

  it('refunds a paid order, revokes that order, and leaves the invoice issued', async () => {
    const order = seedPaid();
    gateway.refund.mockResolvedValue({
      providerRefundId: 'rfnd_1',
      status: 'processed',
      amount: 99900,
    });

    const ordersService = (
      service as unknown as { ordersService: OrdersService }
    ).ordersService;
    const mark = jest
      .spyOn(ordersService, 'markOrderRefunded')
      .mockImplementation(async () => {
        order.status = OrderStatus.REFUNDED;
        payments[0].status = PaymentStatus.REFUNDED;
        return order as never;
      });

    const result = await service.refund(order.id, adminId, 'customer request');

    expect(result.message).toBe(REFUND_COMPLETED_MESSAGE);
    expect(result.data.order.status).toBe(OrderStatus.REFUNDED);
    expect(result.data.order.payment?.status).toBe(PaymentStatus.REFUNDED);
    expect(result.data.refund.status).toBe(RefundStatus.COMPLETED);
    expect(gateway.refund).toHaveBeenCalledWith({
      providerPaymentId: 'pay_1',
      amount: 99900,
      currency: 'INR',
    });
    expect(entitlements.revokePaymentEntitlementsForOrder).toHaveBeenCalledWith(
      order.id,
      adminId,
      'customer request',
    );
    expect(mark).toHaveBeenCalledWith(order.id);
    expect(invoice.status).toBe(TaxInvoiceStatus.ISSUED);
    expect(audit.log.mock.calls.map(call => call[0].action)).toEqual([
      'REFUND_INITIATED',
      'REFUND_COMPLETED',
    ]);
  });

  it('leaves the order paid when the provider outcome is unknown', async () => {
    const order = seedPaid();
    gateway.refund.mockRejectedValue(new BadGatewayException('down'));

    await expect(
      service.refund(order.id, adminId, 'customer request'),
    ).resolves.toMatchObject({ message: REFUND_PENDING_MESSAGE });

    expect(order.status).toBe(OrderStatus.PAID);
    expect(payments[0].status).toBe(PaymentStatus.CAPTURED);
    expect(refunds[0].status).toBe(RefundStatus.INITIATED);
    expect(refunds[0].outcomeUnknownAt).toBeInstanceOf(Date);
    expect(
      entitlements.revokePaymentEntitlementsForOrder,
    ).not.toHaveBeenCalled();
  });

  it('rejects a second refund without calling the provider', async () => {
    const order = seedPaid();
    gateway.refund.mockResolvedValue({
      providerRefundId: 'rfnd_1',
      status: 'processed',
      amount: 99900,
    });
    jest
      .spyOn(
        (service as unknown as { ordersService: OrdersService }).ordersService,
        'markOrderRefunded',
      )
      .mockImplementation(async () => {
        order.status = OrderStatus.REFUNDED;
        return order as never;
      });

    await service.refund(order.id, adminId, 'customer request');
    gateway.refund.mockClear();

    await expect(
      service.refund(order.id, adminId, 'again'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(gateway.refund).not.toHaveBeenCalled();
  });

  it('rejects an unpaid order', async () => {
    const order = seedPaid();
    order.status = OrderStatus.PENDING_PAYMENT;

    await expect(
      service.refund(order.id, adminId, 'customer request'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(gateway.refund).not.toHaveBeenCalled();
  });

  it('includes the buyer name on the order list', async () => {
    const order = seedPaid();
    users.push({
      _id: order.userId,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phoneNumber: '+919876543210',
      username: 'ada',
    });

    const result = await service.list({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].user).toEqual({
      id: String(order.userId),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phoneNumber: '+919876543210',
      username: 'ada',
    });
    expect(result.data[0].userId).toBe(String(order.userId));
  });

  it('keeps the order paid when the provider refund is still pending', async () => {
    const order = seedPaid();
    gateway.refund.mockResolvedValue({
      providerRefundId: 'rfnd_pending',
      status: 'pending',
      amount: 99900,
    });

    const result = await service.refund(order.id, adminId, 'customer request');

    expect(result.message).toBe(REFUND_PENDING_MESSAGE);
    expect(result.data.refund.status).toBe(RefundStatus.INITIATED);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(
      entitlements.revokePaymentEntitlementsForOrder,
    ).not.toHaveBeenCalled();
    expect(invoice.status).toBe(TaxInvoiceStatus.ISSUED);
  });

  it('settles a processed provider refund once', async () => {
    const order = seedPaid();
    const refund = await refundModel.create({
      orderId: order._id,
      paymentId: payments[0]._id,
      userId: order.userId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_later',
      amount: 99900,
      status: RefundStatus.INITIATED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(adminId),
    });
    jest
      .spyOn(
        (service as unknown as { ordersService: OrdersService }).ordersService,
        'markOrderRefunded',
      )
      .mockImplementation(async () => {
        order.status = OrderStatus.REFUNDED;
        return order as never;
      });

    await expect(
      service.settleProcessed('rfnd_later', 99900, 'INR'),
    ).resolves.toBe('settled');
    await expect(
      service.settleProcessed('rfnd_later', 99900, 'INR'),
    ).resolves.toBe('already');

    expect(refund.status).toBe(RefundStatus.COMPLETED);
    expect(
      entitlements.revokePaymentEntitlementsForOrder,
    ).toHaveBeenCalledTimes(1);
    expect(invoice.status).toBe(TaxInvoiceStatus.ISSUED);
  });

  it('does not revoke when the provider amount does not match', async () => {
    const order = seedPaid();
    await refundModel.create({
      orderId: order._id,
      paymentId: payments[0]._id,
      userId: order.userId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_mismatch',
      amount: 99900,
      status: RefundStatus.INITIATED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(adminId),
    });

    await expect(
      service.settleProcessed('rfnd_mismatch', 100, 'INR'),
    ).resolves.toBe('mismatch');
    expect(
      entitlements.revokePaymentEntitlementsForOrder,
    ).not.toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.PAID);
  });

  it('leaves a completed refund alone when the provider later reports failure', async () => {
    const order = seedPaid();
    const refund = await refundModel.create({
      orderId: order._id,
      paymentId: payments[0]._id,
      userId: order.userId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_done',
      amount: 99900,
      status: RefundStatus.COMPLETED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(adminId),
    });

    await expect(service.settleFailed('rfnd_done')).resolves.toBe('left');
    expect(refund.status).toBe(RefundStatus.COMPLETED);
    expect(order.status).toBe(OrderStatus.PAID);
  });

  it('completes an old initiated refund when the provider has processed it', async () => {
    const order = seedPaid();
    const refund = await refundModel.create({
      orderId: order._id,
      paymentId: payments[0]._id,
      userId: order.userId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_old',
      amount: 99900,
      status: RefundStatus.INITIATED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(adminId),
      updatedAt: new Date(Date.now() - 2 * 60 * 1000),
    });
    gateway.fetchRefundStatus.mockResolvedValue({
      providerRefundId: 'rfnd_old',
      status: 'processed',
      amount: 99900,
      currency: 'INR',
    });
    jest
      .spyOn(
        (service as unknown as { ordersService: OrdersService }).ordersService,
        'markOrderRefunded',
      )
      .mockImplementation(async () => {
        order.status = OrderStatus.REFUNDED;
        return order as never;
      });

    const summary = await service.reconcileInitiatedRefunds();

    expect(summary.settled).toBe(1);
    expect(refund.status).toBe(RefundStatus.COMPLETED);
    expect(order.status).toBe(OrderStatus.REFUNDED);
  });

  it('leaves an initiated refund pending when the provider is still pending', async () => {
    const order = seedPaid();
    const refund = await refundModel.create({
      orderId: order._id,
      paymentId: payments[0]._id,
      userId: order.userId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_wait',
      amount: 99900,
      status: RefundStatus.INITIATED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(adminId),
      updatedAt: new Date(Date.now() - 2 * 60 * 1000),
    });
    gateway.fetchRefundStatus.mockResolvedValue({
      providerRefundId: 'rfnd_wait',
      status: 'pending',
      amount: 99900,
      currency: 'INR',
    });

    const summary = await service.reconcileInitiatedRefunds();

    expect(summary.pending).toBe(1);
    expect(refund.status).toBe(RefundStatus.INITIATED);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(
      entitlements.revokePaymentEntitlementsForOrder,
    ).not.toHaveBeenCalled();
  });
});
