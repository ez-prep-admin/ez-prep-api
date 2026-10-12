import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminEntitlementsController } from './admin-entitlements.controller';
import { EntitlementsService } from './entitlements.service';

describe('AdminEntitlementsController', () => {
  let controller: AdminEntitlementsController;
  const service = {
    grant: jest.fn(),
    revoke: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminEntitlementsController],
      providers: [{ provide: EntitlementsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminEntitlementsController);
    jest.clearAllMocks();
  });

  it('requires admin role metadata on the controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminEntitlementsController);
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('registers JwtAuthGuard and RolesGuard on the controller', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminEntitlementsController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('denies non-admin users via RolesGuard (403 path)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const rolesGuard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: () => controller.grant,
      getClass: () => AdminEntitlementsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u1', role: UserRole.USER },
        }),
      }),
    };

    expect(rolesGuard.canActivate(context as never)).toBe(false);
  });

  it('grant wraps service result', async () => {
    const entitlement = { id: 'e1', status: 'ACTIVE' };
    service.grant.mockResolvedValue(entitlement);

    await expect(
      controller.grant(
        {
          userId: 'u1',
          scopeType: 'EXAM' as never,
          scopeId: 's1',
          durationPreset: '3M' as never,
        },
        { id: 'admin1' } as never,
      ),
    ).resolves.toMatchObject({
      message: 'Entitlement granted successfully',
      data: entitlement,
    });
  });

  it('revoke wraps service result', async () => {
    const entitlement = { id: 'e1', status: 'REVOKED' };
    service.revoke.mockResolvedValue(entitlement);

    await expect(
      controller.revoke('e1', { reason: 'support' }, { id: 'admin1' } as never),
    ).resolves.toMatchObject({
      message: 'Entitlement revoked successfully',
      data: entitlement,
    });
  });
});
