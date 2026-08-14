import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  const analyticsService = {
    getDashboard: jest.fn(),
    getLeaderboard: jest.fn(),
    getRecentActivity: jest.fn(),
    getSubjectTopicBreakdown: jest.fn(),
    getUserBadges: jest.fn(),
    getAiInsights: jest.fn(),
  };
  const user = { id: 'u1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: analyticsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AnalyticsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should wrap all analytics endpoints', async () => {
    analyticsService.getDashboard.mockResolvedValue({ streak: {} });
    analyticsService.getLeaderboard.mockResolvedValue({
      data: [],
      pagination: { total: 0 },
      currentUserRank: { rank: null },
    });
    analyticsService.getRecentActivity.mockResolvedValue([]);
    analyticsService.getSubjectTopicBreakdown.mockResolvedValue({
      subjects: [],
    });
    analyticsService.getUserBadges.mockResolvedValue({ badges: [] });
    analyticsService.getAiInsights.mockResolvedValue({ recommendations: [] });

    await expect(controller.getDashboard(user as any)).resolves.toMatchObject({
      message: 'Dashboard retrieved successfully',
    });
    await expect(
      controller.getLeaderboard(user as any, 1, 10, 'e1', 's1'),
    ).resolves.toMatchObject({ currentUserRank: { rank: null } });
    await expect(
      controller.getRecentActivity(user as any, 5),
    ).resolves.toMatchObject({ data: [] });
    await expect(
      controller.getSubjectTopicBreakdown(user as any),
    ).resolves.toMatchObject({ data: { subjects: [] } });
    await expect(controller.getBadges(user as any)).resolves.toMatchObject({
      data: { badges: [] },
    });
    await expect(controller.getAiInsights(user as any)).resolves.toMatchObject({
      data: { recommendations: [] },
    });
  });
});
