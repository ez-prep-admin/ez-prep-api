import { Test, TestingModule } from '@nestjs/testing';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ExamsController', () => {
  let controller: ExamsController;
  const exam = { id: 'e1', name: 'SBI PO' };
  const pagination = {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
  const service = {
    getExamsByCategory: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findByCategory: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamsController],
      providers: [{ provide: ExamsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ExamsController);
    jest.clearAllMocks();
  });

  it('getExamsByCategory wraps data', async () => {
    service.getExamsByCategory.mockResolvedValue([]);
    await expect(controller.getExamsByCategory()).resolves.toEqual({
      message: 'Exams by category retrieved successfully',
      data: [],
    });
  });

  it('create wraps data', async () => {
    service.create.mockResolvedValue(exam);
    await expect(controller.create({} as any)).resolves.toMatchObject({
      data: exam,
    });
  });

  it('findAll uses default message', async () => {
    service.findAll.mockResolvedValue({ data: [exam], pagination });
    const result = await controller.findAll(1, 10);
    expect(result.message).toBe('Exams retrieved successfully');
  });

  it('findAll uses search message', async () => {
    service.findAll.mockResolvedValue({ data: [], pagination });
    const result = await controller.findAll(1, 10, 'sbi');
    expect(result.message).toContain('sbi');
  });

  it('findByCategory wraps data', async () => {
    service.findByCategory.mockResolvedValue({ data: [exam], pagination });
    await expect(controller.findByCategory('c1', 1, 10)).resolves.toMatchObject(
      {
        data: [exam],
      },
    );
  });

  it('findOne wraps data', async () => {
    service.findOne.mockResolvedValue(exam);
    await expect(controller.findOne('e1')).resolves.toMatchObject({
      data: exam,
    });
  });

  it('update wraps data', async () => {
    service.update.mockResolvedValue(exam);
    await expect(controller.update('e1', {} as any)).resolves.toMatchObject({
      data: exam,
    });
  });

  it('remove wraps data', async () => {
    service.remove.mockResolvedValue(exam);
    await expect(controller.remove('e1')).resolves.toMatchObject({
      data: exam,
    });
  });
});
