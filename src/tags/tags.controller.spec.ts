import { Test, TestingModule } from '@nestjs/testing';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('TagsController', () => {
  let controller: TagsController;
  const tag = { id: 't1', name: 'Easy' };
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
      controllers: [TagsController],
      providers: [{ provide: TagsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TagsController);
    jest.clearAllMocks();
  });

  it('create wraps data', async () => {
    service.create.mockResolvedValue(tag);
    await expect(controller.create({} as any)).resolves.toEqual({
      message: 'Tag created successfully',
      data: tag,
    });
  });

  it('findAll wraps paginated data', async () => {
    service.findAll.mockResolvedValue({ data: [tag], pagination });
    const result = await controller.findAll(1, 10, 's1', 't1');
    expect(result.data).toEqual([tag]);
    expect(result.pagination).toEqual(pagination);
  });

  it('findOne wraps data', async () => {
    service.findOne.mockResolvedValue(tag);
    await expect(controller.findOne('t1')).resolves.toMatchObject({
      data: tag,
    });
  });

  it('update wraps data', async () => {
    service.update.mockResolvedValue(tag);
    await expect(controller.update('t1', {} as any)).resolves.toMatchObject({
      data: tag,
    });
  });

  it('remove returns service message', async () => {
    service.remove.mockResolvedValue({ message: 'Tag deleted successfully' });
    await expect(controller.remove('t1')).resolves.toEqual({
      message: 'Tag deleted successfully',
    });
  });
});
