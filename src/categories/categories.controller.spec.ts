import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  const category = { id: 'c1', name: 'Banking' };
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
    findActiveCategories: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CategoriesController);
    jest.clearAllMocks();
  });

  it('create wraps the result', async () => {
    service.create.mockResolvedValue(category);
    await expect(controller.create({} as any)).resolves.toEqual({
      message: 'Category created successfully',
      data: category,
    });
  });

  it('findAll uses default message', async () => {
    service.findAll.mockResolvedValue({ data: [category], pagination });
    const result = await controller.findAll(1, 10);
    expect(result.message).toBe('Categories retrieved successfully');
    expect(result.pagination).toEqual(pagination);
  });

  it('findAll uses search message', async () => {
    service.findAll.mockResolvedValue({ data: [], pagination });
    const result = await controller.findAll(1, 10, 'bank', true);
    expect(result.message).toContain('bank');
  });

  it('findActiveCategories includes count', async () => {
    service.findActiveCategories.mockResolvedValue([category]);
    const result = await controller.findActiveCategories();
    expect(result.count).toBe(1);
  });

  it('findOne wraps the result', async () => {
    service.findOne.mockResolvedValue(category);
    await expect(controller.findOne('c1')).resolves.toMatchObject({
      data: category,
    });
  });

  it('update wraps the result', async () => {
    service.update.mockResolvedValue(category);
    await expect(controller.update('c1', {} as any)).resolves.toMatchObject({
      data: category,
    });
  });

  it('remove wraps the result', async () => {
    service.remove.mockResolvedValue(category);
    await expect(controller.remove('c1')).resolves.toMatchObject({
      data: category,
    });
  });
});
