import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { APP_USER_ROLE } from './admin-users.guardrails';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  const adminUsersService = {
    listAppUsers: jest.fn(),
  };

  const pagination = {
    total: 1,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const learner = {
    id: 'u1',
    name: 'Anita',
    role: APP_USER_ROLE,
    testsAttendedCount: 2,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: adminUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminUsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('wraps the paginated learner list', async () => {
    adminUsersService.listAppUsers.mockResolvedValue({
      data: [learner],
      pagination,
    });

    await expect(controller.list(1, 12, 'anita')).resolves.toEqual({
      message: 'App users retrieved successfully',
      data: [learner],
      pagination,
    });
    expect(adminUsersService.listAppUsers).toHaveBeenCalledWith(1, 12, 'anita');
  });

  it('never forwards a role argument to the service', async () => {
    adminUsersService.listAppUsers.mockResolvedValue({
      data: [],
      pagination,
    });

    await controller.list(2, 24);

    expect(adminUsersService.listAppUsers.mock.calls[0]).toEqual([
      2,
      24,
      undefined,
    ]);
    expect(adminUsersService.listAppUsers.mock.calls[0]).not.toContain(
      UserRole.ADMIN,
    );
  });

  it('returns only the service payload even if an admin row were present', async () => {
    adminUsersService.listAppUsers.mockResolvedValue({
      data: [learner],
      pagination,
    });

    const result = await controller.list(1, 12);
    expect(result.data.every(item => item.role === UserRole.USER)).toBe(true);
  });
});
