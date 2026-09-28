import { Test, TestingModule } from '@nestjs/testing';
import { InstanceConfigController } from './instance-config.controller';
import { InstanceConfigService } from './instance-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('InstanceConfigController', () => {
  let controller: InstanceConfigController;
  const config = { id: 'singleton', name: 'EZ Prep' };
  const service = {
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstanceConfigController],
      providers: [{ provide: InstanceConfigService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(InstanceConfigController);
    jest.clearAllMocks();
  });

  it('reports when configuration has not been set', async () => {
    service.get.mockResolvedValue(null);
    await expect(controller.get()).resolves.toEqual({
      message: 'Instance configuration has not been set',
      data: null,
    });
  });

  it('wraps the stored configuration', async () => {
    service.get.mockResolvedValue(config);
    await expect(controller.get()).resolves.toEqual({
      message: 'Instance configuration retrieved successfully',
      data: config,
    });
  });

  it('creates the configuration', async () => {
    service.create.mockResolvedValue(config);
    await expect(controller.create({ name: 'EZ Prep' })).resolves.toEqual({
      message: 'Instance configuration created successfully',
      data: config,
    });
  });

  it('updates the configuration', async () => {
    service.update.mockResolvedValue(config);
    await expect(controller.update({ logoUrl: null })).resolves.toEqual({
      message: 'Instance configuration updated successfully',
      data: config,
    });
  });
});
