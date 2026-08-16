import { Test, TestingModule } from '@nestjs/testing';
import { MockTestAttemptsController } from './mock-test-attempts.controller';
import { MockTestAttemptsService } from './mock-test-attempts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('MockTestAttemptsController', () => {
  let controller: MockTestAttemptsController;
  const service = {
    startAttempt: jest.fn(),
    findUserAttempts: jest.fn(),
    findUserTestAttempts: jest.fn(),
    updateAnswer: jest.fn(),
    pauseAttempt: jest.fn(),
    completeSession: jest.fn(),
    submitAttempt: jest.fn(),
    resumeAttempt: jest.fn(),
    findOne: jest.fn(),
  };
  const user = { id: 'u1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MockTestAttemptsController],
      providers: [{ provide: MockTestAttemptsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MockTestAttemptsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should wrap start, list, pause, resume, get', async () => {
    service.startAttempt.mockResolvedValue({ attemptId: 'a1' });
    service.findUserAttempts.mockResolvedValue([{ attemptId: 'a1' }]);
    service.findUserTestAttempts.mockResolvedValue([]);
    service.pauseAttempt.mockResolvedValue({ status: 'PAUSED' });
    service.resumeAttempt.mockResolvedValue({ attemptId: 'a1' });
    service.findOne.mockResolvedValue({ attemptId: 'a1' });

    await expect(
      controller.startAttempt({ mockTestId: 't1' }, user as any),
    ).resolves.toMatchObject({ data: { attemptId: 'a1' } });
    await expect(controller.getMyAttempts(user as any)).resolves.toMatchObject({
      count: 1,
    });
    await expect(
      controller.getMyTestAttempts('t1', user as any),
    ).resolves.toMatchObject({ count: 0 });
    await expect(
      controller.pauseAttempt('a1', user as any),
    ).resolves.toMatchObject({ data: { status: 'PAUSED' } });
    await expect(
      controller.resumeAttempt('a1', user as any),
    ).resolves.toMatchObject({ data: { attemptId: 'a1' } });
    await expect(
      controller.getAttempt('a1', user as any),
    ).resolves.toMatchObject({ data: { attemptId: 'a1' } });
  });

  it('should call updateAnswer and complete/submit with messages', async () => {
    service.updateAnswer.mockResolvedValue(undefined);
    service.completeSession
      .mockResolvedValueOnce({ paperCompleted: false })
      .mockResolvedValueOnce({ paperCompleted: true });
    service.submitAttempt
      .mockResolvedValueOnce({ questionResults: [] })
      .mockResolvedValueOnce({});

    await controller.updateAnswer(
      'a1',
      { questionId: 'q1', selectedOptionId: 'x' },
      user as any,
    );
    expect(service.updateAnswer).toHaveBeenCalled();

    const mid = await controller.completeSession('a1', user as any);
    expect(mid.message).toContain('Next subject');
    const last = await controller.completeSession('a1', user as any);
    expect(last.message).toContain('Paper submitted');

    const withResults = await controller.submitAttempt('a1', {}, user as any);
    expect(withResults.message).toContain('Results are available');
    const later = await controller.submitAttempt('a1', {}, user as any);
    expect(later.message).toContain('later');
  });
});
