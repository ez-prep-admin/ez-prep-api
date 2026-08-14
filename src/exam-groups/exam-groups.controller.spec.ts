import { Test, TestingModule } from '@nestjs/testing';
import { ExamGroupsController } from './exam-groups.controller';
import { ExamGroupsService } from './exam-groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ExamGroupsController', () => {
  let controller: ExamGroupsController;
  const group = { id: 'g1', name: 'UPSC CSE' };
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
    findActiveExamGroups: jest.fn(),
    findGroupedByCategory: jest.fn(),
    findByCategory: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamGroupsController],
      providers: [{ provide: ExamGroupsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ExamGroupsController);
    jest.clearAllMocks();
  });

  it('create wraps data', async () => {
    service.create.mockResolvedValue(group);
    await expect(controller.create({} as any)).resolves.toMatchObject({
      data: group,
    });
  });

  it('findAll default message', async () => {
    service.findAll.mockResolvedValue({ data: [group], pagination });
    const result = await controller.findAll(1, 10);
    expect(result.message).toBe('Exam groups retrieved successfully');
  });

  it('findAll search message', async () => {
    service.findAll.mockResolvedValue({ data: [], pagination });
    const result = await controller.findAll(1, 10, 'upsc');
    expect(result.message).toContain('upsc');
  });

  it('findActiveExamGroups includes count', async () => {
    service.findActiveExamGroups.mockResolvedValue([group]);
    expect((await controller.findActiveExamGroups()).count).toBe(1);
  });

  it('findGroupedByCategory includes count', async () => {
    service.findGroupedByCategory.mockResolvedValue([{ id: 'c1' }]);
    expect((await controller.findGroupedByCategory()).count).toBe(1);
  });

  it('findByCategory includes count', async () => {
    service.findByCategory.mockResolvedValue([group]);
    expect((await controller.findByCategory('c1')).count).toBe(1);
  });

  it('findOne wraps data', async () => {
    service.findOne.mockResolvedValue(group);
    await expect(controller.findOne('g1')).resolves.toMatchObject({ data: group });
  });

  it('update wraps data', async () => {
    service.update.mockResolvedValue(group);
    await expect(controller.update('g1', {} as any)).resolves.toMatchObject({
      data: group,
    });
  });

  it('remove wraps data', async () => {
    service.remove.mockResolvedValue(group);
    await expect(controller.remove('g1')).resolves.toMatchObject({ data: group });
  });
});
