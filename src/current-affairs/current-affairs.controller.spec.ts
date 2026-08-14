import { Test, TestingModule } from '@nestjs/testing';
import { CurrentAffairsController } from './current-affairs.controller';
import { CurrentAffairsService } from './current-affairs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('CurrentAffairsController', () => {
  let controller: CurrentAffairsController;
  const item = {
    id: 'ca1',
    title: 'Satellite launch',
    date: '2026-08-14',
  };
  const pagination = {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrentAffairsController],
      providers: [{ provide: CurrentAffairsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CurrentAffairsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create wraps the result', async () => {
    service.create.mockResolvedValue(item);
    const dto = {
      title: 'Satellite launch',
      description: 'ISRO launch',
      date: '2026-08-14',
    };
    await expect(controller.create(dto as any)).resolves.toEqual({
      message: 'Current affair created successfully',
      data: item,
    });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll uses the default message when date is omitted', async () => {
    service.findAll.mockResolvedValue({ data: [item], pagination });
    const result = await controller.findAll(1, 10);
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      10,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual({
      message: 'Current affairs retrieved successfully',
      data: [item],
      pagination,
    });
  });

  it('findAll includes the date in the message when filtered', async () => {
    service.findAll.mockResolvedValue({ data: [item], pagination });
    const result = await controller.findAll(
      1,
      100,
      '2026-08-14',
      'ISRO',
      true,
    );
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      100,
      '2026-08-14',
      'ISRO',
      true,
    );
    expect(result.message).toBe(
      'Current affairs for 2026-08-14 retrieved successfully',
    );
  });

  it('findOne wraps the result', async () => {
    service.findOne.mockResolvedValue(item);
    await expect(controller.findOne('ca1')).resolves.toEqual({
      message: 'Current affair retrieved successfully',
      data: item,
    });
  });

  it('update wraps the result', async () => {
    service.update.mockResolvedValue(item);
    await expect(
      controller.update('ca1', { title: 'Updated' } as any),
    ).resolves.toEqual({
      message: 'Current affair updated successfully',
      data: item,
    });
  });

  it('remove wraps the result', async () => {
    service.remove.mockResolvedValue(item);
    await expect(controller.remove('ca1')).resolves.toEqual({
      message: 'Current affair deleted successfully',
      data: item,
    });
  });
});
