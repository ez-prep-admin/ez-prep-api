import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeBillingProfileController } from './me-billing-profile.controller';
import { UsersService } from './users.service';

describe('MeBillingProfileController', () => {
  const users = {
    getBillingProfile: jest.fn(),
    updateBillingProfile: jest.fn(),
  };
  let controller: MeBillingProfileController;

  beforeEach(async () => {
    users.getBillingProfile.mockReset();
    users.updateBillingProfile.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeBillingProfileController],
      providers: [{ provide: UsersService, useValue: users }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MeBillingProfileController);
  });

  it('returns null when no profile is saved', async () => {
    users.getBillingProfile.mockResolvedValue(null);

    await expect(
      controller.getMine({ id: 'user-1' } as never),
    ).resolves.toEqual({
      message: 'Billing profile retrieved successfully',
      data: null,
    });
    expect(users.getBillingProfile).toHaveBeenCalledWith('user-1');
  });

  it('updates only the caller profile', async () => {
    const saved = { name: 'Asha', stateCode: '32' };
    users.updateBillingProfile.mockResolvedValue(saved);
    const body = { name: 'Asha', stateCode: '32' };

    await expect(
      controller.updateMine({ id: 'user-1' } as never, body as never),
    ).resolves.toEqual({
      message: 'Billing profile updated successfully',
      data: saved,
    });
    expect(users.updateBillingProfile).toHaveBeenCalledWith('user-1', body);
  });
});
