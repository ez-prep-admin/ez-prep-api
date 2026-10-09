import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { Payment } from '../payments/schemas/payment.schema';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const ORDER_ID = '507f1f77bcf86cd799439013';

function listQuery(rows: unknown[]) {
  const chain = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    exec: jest.fn().mockResolvedValue(rows),
  };
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

describe('OrdersService user history', () => {
  let service: OrdersService;
  const orderModel = {
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: {} },
        { provide: ORDER_PAID_HANDLER, useValue: {} },
        { provide: EntitlementProvisioningService, useValue: {} },
      ],
    }).compile();
    service = module.get(OrdersService);
    orderModel.find.mockReset();
    orderModel.findById.mockReset();
    orderModel.countDocuments.mockReset();
  });

  it('lists only the caller orders and omits provider secrets', async () => {
    const row = {
      id: ORDER_ID,
      userId: new Types.ObjectId(USER_ID),
      orderNumber: 'ORD-1',
      status: OrderStatus.PENDING_PAYMENT,
      amount: 99900,
      currency: 'INR',
      idempotencyKey: 'secret-key',
      providerOrderId: 'order_secret',
      items: [
        {
          productName: 'SSC Pack',
          durationPreset: DurationPreset.THREE_MONTHS,
          amount: 99900,
        },
      ],
    };
    orderModel.find.mockReturnValue(listQuery([row]));
    orderModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const result = await service.listForUser(USER_ID, { page: 1, limit: 500 });

    const query = orderModel.find.mock.calls[0][0] as {
      userId: Types.ObjectId;
    };
    expect(String(query.userId)).toBe(USER_ID);
    expect(orderModel.find.mock.results[0].value.limit).toHaveBeenCalledWith(
      100,
    );
    expect(result.data).toEqual([
      {
        id: ORDER_ID,
        orderNumber: 'ORD-1',
        status: OrderStatus.PENDING_PAYMENT,
        amount: 99900,
        currency: 'INR',
        createdAt: undefined,
        paidAt: undefined,
        expiresAt: undefined,
        items: [
          {
            productName: 'SSC Pack',
            durationPreset: DurationPreset.THREE_MONTHS,
            amount: 99900,
          },
        ],
      },
    ]);
    expect(result.data[0]).not.toHaveProperty('idempotencyKey');
    expect(result.data[0]).not.toHaveProperty('providerOrderId');
    expect(result.pagination.limit).toBe(100);
  });

  it('returns an empty page for an invalid user id', async () => {
    const result = await service.listForUser('not-an-id', {});

    expect(result.data).toEqual([]);
    expect(orderModel.find).not.toHaveBeenCalled();
  });

  it('hides another user order', async () => {
    orderModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        id: ORDER_ID,
        userId: new Types.ObjectId(OTHER_ID),
      }),
    });

    await expect(service.getForUser(USER_ID, ORDER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
