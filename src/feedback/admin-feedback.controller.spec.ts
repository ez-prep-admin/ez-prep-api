import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminFeedbackController } from './admin-feedback.controller';
import { FeedbackService } from './feedback.service';

describe('AdminFeedbackController', () => {
  let controller: AdminFeedbackController;
  const feedbackService = {
    summary: jest.fn(),
    list: jest.fn(),
  };

  const summary = {
    feedbackCount: 0,
    overall: null,
    ratedCount: 0,
    userInterface: { average: null, count: 0 },
    questions: { average: null, count: 0 },
    fullMockTests: { average: null, count: 0 },
    topicWisePractice: { average: null, count: 0 },
    easeOfUse: { average: null, count: 0 },
  };

  const pagination = {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFeedbackController],
      providers: [{ provide: FeedbackService, useValue: feedbackService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminFeedbackController);
    jest.clearAllMocks();
  });

  it('wraps the rating summary', async () => {
    feedbackService.summary.mockResolvedValue(summary);

    await expect(controller.summary()).resolves.toEqual({
      message: 'Feedback summary retrieved successfully',
      data: summary,
    });
  });

  it('wraps the paginated list and forwards page and limit', async () => {
    feedbackService.list.mockResolvedValue({ data: [], pagination });

    await expect(controller.list(2, 20)).resolves.toEqual({
      message: 'Feedback retrieved successfully',
      data: [],
      pagination,
    });
    expect(feedbackService.list).toHaveBeenCalledWith(2, 20);
  });
});
