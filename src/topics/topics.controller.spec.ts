import { Test, TestingModule } from '@nestjs/testing';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('TopicsController', () => {
  let controller: TopicsController;
  const topic = { id: 't1', name: 'Ratio' };
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicsController],
      providers: [{ provide: TopicsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TopicsController);
    jest.clearAllMocks();
  });

  it('create wraps data', async () => {
    service.create.mockResolvedValue(topic);
    await expect(controller.create({} as any)).resolves.toMatchObject({
      data: topic,
    });
  });

  it('findAll includes count', async () => {
    service.findAll.mockResolvedValue([topic]);
    expect((await controller.findAll()).count).toBe(1);
  });

  it('findOne wraps data', async () => {
    service.findOne.mockResolvedValue(topic);
    await expect(controller.findOne('t1')).resolves.toMatchObject({
      data: topic,
    });
  });

  it('update wraps data', async () => {
    service.update.mockResolvedValue(topic);
    await expect(controller.update('t1', {} as any)).resolves.toMatchObject({
      data: topic,
    });
  });

  it('remove wraps data', async () => {
    service.remove.mockResolvedValue(topic);
    await expect(controller.remove('t1')).resolves.toMatchObject({
      data: topic,
    });
  });
});
