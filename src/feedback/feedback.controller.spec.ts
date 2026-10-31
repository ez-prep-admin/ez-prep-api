import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  const feedbackService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [{ provide: FeedbackService, useValue: feedbackService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FeedbackController);
    jest.clearAllMocks();
  });

  it('stores feedback for the signed-in user', async () => {
    const data = {
      id: 'feedback-1',
      text: 'Clearer results',
      ratings: { easeOfUse: 5 },
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    feedbackService.create.mockResolvedValue(data);

    await expect(
      controller.create({ id: 'user-1' } as never, {
        easeOfUse: 5,
        text: 'Clearer results',
      }),
    ).resolves.toEqual({
      message: 'Feedback submitted successfully',
      data,
    });
    expect(feedbackService.create).toHaveBeenCalledWith('user-1', {
      easeOfUse: 5,
      text: 'Clearer results',
    });
  });
});
