import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminCommerceAuditController } from './admin-commerce-audit.controller';
import { CommerceAuditService } from './commerce-audit.service';

describe('AdminCommerceAuditController', () => {
  const commerceAuditService = {
    list: jest.fn(),
  };
  let controller: AdminCommerceAuditController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCommerceAuditController],
      providers: [
        { provide: CommerceAuditService, useValue: commerceAuditService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminCommerceAuditController);
    jest.clearAllMocks();
  });

  it('requires admin role metadata on the controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminCommerceAuditController);
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('registers JwtAuthGuard and RolesGuard on the controller', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminCommerceAuditController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('lists audit logs', async () => {
    commerceAuditService.list.mockResolvedValue({
      data: [{ action: 'PRODUCT_PUBLISHED' }],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });

    await expect(
      controller.list('1', '20', 'PRODUCT_PUBLISHED', 'product'),
    ).resolves.toMatchObject({
      message: 'Commerce audit logs retrieved successfully',
      data: [{ action: 'PRODUCT_PUBLISHED' }],
    });
    expect(commerceAuditService.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      action: 'PRODUCT_PUBLISHED',
      resourceType: 'product',
    });
  });
});
