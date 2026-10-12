import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommerceEnabledGuard } from '../commerce/commerce-enabled.guard';
import { MeOrdersController } from './me-orders.controller';
import { OrdersService } from './orders.service';

describe('MeOrdersController', () => {
  const orders = {
    listForUser: jest.fn(),
    getForUser: jest.fn(),
  };
  let controller: MeOrdersController;

  beforeEach(async () => {
    orders.listForUser.mockReset();
    orders.getForUser.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeOrdersController],
      providers: [{ provide: OrdersService, useValue: orders }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CommerceEnabledGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MeOrdersController);
  });

  it('lists the caller orders', async () => {
    const page = {
      data: [],
      pagination: { total: 0, page: 1, limit: 20 },
    };
    orders.listForUser.mockResolvedValue(page);

    await expect(
      controller.listMine({ id: 'user-1' } as never, '2', '10'),
    ).resolves.toEqual({
      message: 'Orders retrieved successfully',
      data: [],
      pagination: page.pagination,
    });
    expect(orders.listForUser).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
    });
  });

  it('returns 404 for an order the caller does not own', async () => {
    orders.getForUser.mockRejectedValue(
      new NotFoundException('Order not found'),
    );

    await expect(
      controller.getMine({ id: 'user-2' } as never, 'order-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(orders.getForUser).toHaveBeenCalledWith('user-2', 'order-1');
  });
});
