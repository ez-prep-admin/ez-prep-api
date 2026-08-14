import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';

describe('UsersController', () => {
  let controller: UsersController;

  const user = { id: 'u1', name: 'John', isActive: true };
  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByRole: jest.fn(),
    getUserStats: jest.fn(),
    findAllWithDeleted: jest.fn(),
    findOne: jest.fn(),
    updateMe: jest.fn(),
    updatePreferences: jest.fn(),
    update: jest.fn(),
    updateSubscription: jest.fn(),
    toggleUserStatus: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    hardDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create wraps the service result', async () => {
    mockUsersService.create.mockResolvedValue(user);
    await expect(controller.create({ name: 'John' } as any)).resolves.toEqual({
      message: 'User created successfully',
      data: user,
    });
  });

  it('findAll without role uses findAll', async () => {
    mockUsersService.findAll.mockResolvedValue([user]);
    const result = await controller.findAll();
    expect(mockUsersService.findAll).toHaveBeenCalled();
    expect(result.count).toBe(1);
  });

  it('findAll with role uses findByRole', async () => {
    mockUsersService.findByRole.mockResolvedValue([user]);
    const result = await controller.findAll(UserRole.ADMIN);
    expect(mockUsersService.findByRole).toHaveBeenCalledWith(UserRole.ADMIN);
    expect(result.data).toEqual([user]);
  });

  it('getUserStats wraps stats', async () => {
    mockUsersService.getUserStats.mockResolvedValue({ totalUsers: 1 });
    await expect(controller.getUserStats()).resolves.toEqual({
      message: 'User statistics retrieved successfully',
      data: { totalUsers: 1 },
    });
  });

  it('findAllWithDeleted wraps list', async () => {
    mockUsersService.findAllWithDeleted.mockResolvedValue([user]);
    const result = await controller.findAllWithDeleted();
    expect(result.count).toBe(1);
  });

  it('getMyProfile re-fetches the current user', async () => {
    mockUsersService.findOne.mockResolvedValue(user);
    await expect(controller.getMyProfile(user as any)).resolves.toEqual({
      message: 'Profile retrieved successfully',
      data: user,
    });
    expect(mockUsersService.findOne).toHaveBeenCalledWith('u1');
  });

  it('updateMe wraps the service result', async () => {
    mockUsersService.updateMe.mockResolvedValue(user);
    await expect(
      controller.updateMe(user as any, { name: 'X' } as any),
    ).resolves.toMatchObject({ data: user });
  });

  it('updateMyPreferences wraps the service result', async () => {
    mockUsersService.updatePreferences.mockResolvedValue(user);
    await expect(
      controller.updateMyPreferences(user as any, {} as any),
    ).resolves.toMatchObject({ data: user });
  });

  it('findOne wraps the service result', async () => {
    mockUsersService.findOne.mockResolvedValue(user);
    await expect(controller.findOne('u1')).resolves.toMatchObject({ data: user });
  });

  it('update wraps the service result', async () => {
    mockUsersService.update.mockResolvedValue(user);
    await expect(controller.update('u1', { name: 'X' })).resolves.toMatchObject({
      data: user,
    });
  });

  it('updateSubscription wraps the service result', async () => {
    mockUsersService.updateSubscription.mockResolvedValue(user);
    await expect(
      controller.updateSubscription('u1', {} as any),
    ).resolves.toMatchObject({ data: user });
  });

  it('toggleStatus uses activated/deactivated message', async () => {
    mockUsersService.toggleUserStatus.mockResolvedValue({
      ...user,
      isActive: false,
    });
    const result = await controller.toggleStatus('u1');
    expect(result.message).toContain('deactivated');
  });

  it('softDelete wraps the service result', async () => {
    mockUsersService.softDelete.mockResolvedValue(user);
    await expect(controller.softDelete('u1')).resolves.toMatchObject({
      data: user,
    });
  });

  it('restore wraps the service result', async () => {
    mockUsersService.restore.mockResolvedValue(user);
    await expect(controller.restore('u1')).resolves.toMatchObject({ data: user });
  });

  it('hardDelete delegates to the service', async () => {
    mockUsersService.hardDelete.mockResolvedValue(undefined);
    await expect(controller.hardDelete('u1')).resolves.toBeUndefined();
  });
});
