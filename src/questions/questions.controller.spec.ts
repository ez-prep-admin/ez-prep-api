import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('QuestionsController', () => {
  let controller: QuestionsController;
  const question = { id: 'q1' };
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
      controllers: [QuestionsController],
      providers: [{ provide: QuestionsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(QuestionsController);
    jest.clearAllMocks();
  });

  it('create wraps data', async () => {
    service.create.mockResolvedValue(question);
    await expect(controller.create({} as any)).resolves.toEqual({
      message: 'Question created successfully',
      data: question,
    });
  });

  it('findAll wraps paginated data', async () => {
    service.findAll.mockResolvedValue({ data: [question], pagination });
    const result = await controller.findAll(1, 10, 's', 't', 'e');
    expect(service.findAll).toHaveBeenCalledWith(1, 10, 's', 't', 'e');
    expect(result.data).toEqual([question]);
  });

  it('findOne wraps data', async () => {
    service.findOne.mockResolvedValue(question);
    await expect(controller.findOne('q1')).resolves.toMatchObject({
      data: question,
    });
  });

  it('update wraps data', async () => {
    service.update.mockResolvedValue(question);
    await expect(controller.update('q1', {} as any)).resolves.toMatchObject({
      data: question,
    });
  });

  it('remove returns service message', async () => {
    service.remove.mockResolvedValue({ message: 'Question deleted successfully' });
    await expect(controller.remove('q1')).resolves.toEqual({
      message: 'Question deleted successfully',
    });
  });
});
