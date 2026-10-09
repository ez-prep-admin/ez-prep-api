import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { Payment } from '../payments/schemas/payment.schema';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';

describe('OrdersService markOrderRefunded', () => {
  const orders: Array<Record<string, any>> = [];
  const payments: Array<Record<string, any>> = [];
  const orderModel = { findById: jest.fn() };
  const paymentModel = { findOne: jest.fn() };
  let service: OrdersService;

  beforeEach(async () => {
    orders.length = 0;
    payments.length = 0;
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: ORDER_PAID_HANDLER, useValue: { onOrderPaid: jest.fn() } },
        {
          provide: EntitlementProvisioningService,
          useValue: { provisionForPaidOrder: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('moves a paid order and captured payment to REFUNDED', async () => {
    const _id = new Types.ObjectId();
    const order = {
      _id,
      id: _id.toHexString(),
      status: OrderStatus.PAID,
      save: jest.fn(async function save(this: Record<string, unknown>) {
        return this;
      }),
    };
    orders.push(order);
    const payment = {
      orderId: _id,
      status: PaymentStatus.CAPTURED,
      save: jest.fn(async function save(this: Record<string, unknown>) {
        return this;
      }),
    };
    payments.push(payment);

    await service.markOrderRefunded(order.id);

    expect(order.status).toBe(OrderStatus.REFUNDED);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });
});
