import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminGrantTargetsController } from './admin-grant-targets.controller';
import { GrantTargetsService } from './grant-targets.service';

describe('AdminGrantTargetsController', () => {
  let controller: AdminGrantTargetsController;
  const service = { search: jest.fn() };
  const pagination = {
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGrantTargetsController],
      providers: [{ provide: GrantTargetsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminGrantTargetsController);
    jest.clearAllMocks();
  });

  it('requires admin role metadata on the controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminGrantTargetsController);
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('registers JwtAuthGuard and RolesGuard on the controller', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminGrantTargetsController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('denies non-admin users via RolesGuard', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const rolesGuard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: () => controller.search,
      getClass: () => AdminGrantTargetsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u1', role: UserRole.USER },
        }),
      }),
    };

    expect(rolesGuard.canActivate(context as never)).toBe(false);
  });

  it('passes query params through and wraps the result', async () => {
    service.search.mockResolvedValue({
      data: [{ id: 'e1', label: 'SSC CGL' }],
      pagination,
    });

    await expect(
      controller.search(EntitlementScopeType.EXAM, 'cgl', 2, 20, undefined),
    ).resolves.toEqual({
      message: 'Grant targets retrieved successfully',
      data: [{ id: 'e1', label: 'SSC CGL' }],
      pagination,
    });
    expect(service.search).toHaveBeenCalledWith({
      scopeType: EntitlementScopeType.EXAM,
      search: 'cgl',
      page: 2,
      limit: 20,
      ids: undefined,
    });
  });
});
