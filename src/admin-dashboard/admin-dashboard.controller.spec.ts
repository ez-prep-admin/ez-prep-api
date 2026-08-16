import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  const adminDashboardService = {
    getSummary: jest.fn(),
    getUsers: jest.fn(),
    getQuestions: jest.fn(),
    getFailedQuestions: jest.fn(),
    getMockTests: jest.fn(),
    getFullMockTests: jest.fn(),
    getAttempts: jest.fn(),
    getExams: jest.fn(),
    getSubjects: jest.fn(),
    getTopics: jest.fn(),
    getTags: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        { provide: AdminDashboardService, useValue: adminDashboardService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminDashboardController);
    jest.clearAllMocks();
  });

  it('should wrap summary and detail endpoints', async () => {
    adminDashboardService.getSummary.mockResolvedValue({ attempts: 1 });
    adminDashboardService.getUsers.mockResolvedValue({ totalLearners: 1 });
    adminDashboardService.getQuestions.mockResolvedValue({ totalActive: 1 });
    adminDashboardService.getFailedQuestions.mockResolvedValue({ total: 0 });
    adminDashboardService.getMockTests.mockResolvedValue({ total: 0 });
    adminDashboardService.getFullMockTests.mockResolvedValue({
      totalPublished: 0,
    });
    adminDashboardService.getAttempts.mockResolvedValue({ total: 0 });
    adminDashboardService.getExams.mockResolvedValue({ totalActive: 0 });
    adminDashboardService.getSubjects.mockResolvedValue({ totalActive: 0 });
    adminDashboardService.getTopics.mockResolvedValue({ totalActive: 0 });
    adminDashboardService.getTags.mockResolvedValue({ totalActive: 0 });

    await expect(controller.getSummary()).resolves.toMatchObject({
      data: { attempts: 1 },
    });
    await expect(controller.getUsers()).resolves.toMatchObject({
      data: { totalLearners: 1 },
    });
    await expect(controller.getQuestions()).resolves.toMatchObject({
      data: { totalActive: 1 },
    });
    await expect(controller.getFailedQuestions()).resolves.toMatchObject({
      data: { total: 0 },
    });
    await expect(controller.getMockTests()).resolves.toMatchObject({
      data: { total: 0 },
    });
    await expect(controller.getFullMockTests()).resolves.toMatchObject({
      data: { totalPublished: 0 },
    });
    await expect(controller.getAttempts()).resolves.toMatchObject({
      data: { total: 0 },
    });
    await expect(controller.getExams()).resolves.toMatchObject({
      data: { totalActive: 0 },
    });
    await expect(controller.getSubjects()).resolves.toMatchObject({
      data: { totalActive: 0 },
    });
    await expect(controller.getTopics()).resolves.toMatchObject({
      data: { totalActive: 0 },
    });
    await expect(controller.getTags()).resolves.toMatchObject({
      data: { totalActive: 0 },
    });
  });
});
