import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { Payment } from '../payments/schemas/payment.schema';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import {
  memoryFindOneAndUpdate,
  memoryUpdateOne,
} from './testing/memory-documents';

describe('OrdersService markOrderPaid provisioning', () => {
  const orders: Array<Record<string, any>> = [];
  const payments: Array<Record<string, any>> = [];
  const paidHandler = { onOrderPaid: jest.fn() };
  const provisioning = { provisionForPaidOrder: jest.fn() };
  const orderModel = {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const paymentModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  };

  let service: OrdersService;

  beforeEach(async () => {
    orders.length = 0;
    payments.length = 0;
    paidHandler.onOrderPaid.mockReset();
    paidHandler.onOrderPaid.mockResolvedValue(undefined);
    provisioning.provisionForPaidOrder.mockReset();
    provisioning.provisionForPaidOrder.mockResolvedValue(undefined);

    orderModel.findById.mockImplementation((id: string) => ({
      exec: async () =>
        orders.find(
          order => order.id === String(id) || String(order._id) === String(id),
        ) ?? null,
    }));
    paymentModel.findOne.mockImplementation(
      (filter: { orderId: { toString(): string } }) => ({
        exec: async () =>
          payments.find(
            payment => String(payment.orderId) === String(filter.orderId),
          ) ?? null,
      }),
    );
    orderModel.findOneAndUpdate.mockImplementation((filter, update) => ({
      exec: async () => memoryFindOneAndUpdate(orders, filter, update),
    }));
    orderModel.updateOne.mockImplementation((filter, update) => ({
      exec: async () => memoryUpdateOne(orders, filter, update),
    }));
    paymentModel.findOneAndUpdate.mockImplementation((filter, update) => ({
      exec: async () => memoryFindOneAndUpdate(payments, filter, update),
    }));
    paymentModel.create.mockImplementation(
      async (doc: Record<string, unknown>) => {
        const row = { ...doc, _id: new Types.ObjectId() };
        payments.push(row);
        return row;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: ORDER_PAID_HANDLER, useValue: paidHandler },
        { provide: EntitlementProvisioningService, useValue: provisioning },
        {
          provide: CommerceAuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  function seed() {
    const _id = new Types.ObjectId();
    const order: {
      _id: Types.ObjectId;
      id: string;
      userId: Types.ObjectId;
      status: OrderStatus;
      amount: number;
      provisionedAt?: Date;
      save: jest.Mock;
    } = {
      _id,
      id: _id.toHexString(),
      userId: new Types.ObjectId(),
      status: OrderStatus.PENDING_PAYMENT,
      amount: 79900,
      save: jest.fn(async function save(this: Record<string, unknown>) {
        return this;
      }),
    };
    orders.push(order);
    payments.push({
      orderId: _id,
      status: PaymentStatus.INITIATED,
      save: jest.fn(async function save(this: Record<string, unknown>) {
        return this;
      }),
    });
    return order;
  }

  it('calls the paid handler once on the first transition and not the repair path', async () => {
    const order = seed();

    await service.markOrderPaid(order.id, { providerPaymentId: 'pay_1' });

    expect(order.status).toBe(OrderStatus.PAID);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(provisioning.provisionForPaidOrder).not.toHaveBeenCalled();
  });

  it('does not provision again when a later paid signal finds provisionedAt unset', async () => {
    const order = seed();
    await service.markOrderPaid(order.id, { providerPaymentId: 'pay_1' });

    await service.markOrderPaid(order.id, { providerPaymentId: 'pay_1' });

    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(provisioning.provisionForPaidOrder).not.toHaveBeenCalled();
  });

  it('skips repair when provisionedAt is already set', async () => {
    const order = seed();
    await service.markOrderPaid(order.id, { providerPaymentId: 'pay_1' });
    order.provisionedAt = new Date();

    await service.markOrderPaid(order.id, { providerPaymentId: 'pay_1' });

    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(provisioning.provisionForPaidOrder).not.toHaveBeenCalled();
  });
});
