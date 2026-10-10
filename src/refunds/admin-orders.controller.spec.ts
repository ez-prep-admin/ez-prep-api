import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminOrdersController } from './admin-orders.controller';
import { RepairSweepsService } from '../orders/repair-sweeps.service';
import { RefundsService } from './refunds.service';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;
  const service = {
    list: jest.fn(),
    get: jest.fn(),
    refund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [
        { provide: RefundsService, useValue: service },
        { provide: RepairSweepsService, useValue: { repairOrder: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminOrdersController);
    jest.clearAllMocks();
  });

  it('requires admin role metadata on the controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminOrdersController);
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('registers JwtAuthGuard and RolesGuard on the controller', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminOrdersController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('denies non-admin users via RolesGuard (403 path)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const rolesGuard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: () => controller.refund,
      getClass: () => AdminOrdersController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u1', role: UserRole.USER },
        }),
      }),
    };

    expect(rolesGuard.canActivate(context as never)).toBe(false);
  });

  it('refund wraps the service result', async () => {
    service.refund.mockResolvedValue({
      message: 'Order refunded',
      data: { refund: { status: 'COMPLETED' } },
    });

    await expect(
      controller.refund('order1', { reason: 'support' }, {
        id: 'admin1',
      } as never),
    ).resolves.toMatchObject({
      message: 'Order refunded',
    });
    expect(service.refund).toHaveBeenCalledWith('order1', 'admin1', 'support');
  });
});
