import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { FeedbackService } from './feedback.service';
import { Feedback } from './schemas/feedback.schema';

const USER_ID = '507f1f77bcf86cd799439011';

function listChain(result: unknown) {
  const query: {
    exec: jest.Mock;
    populate: jest.Mock;
    sort: jest.Mock;
    skip: jest.Mock;
    limit: jest.Mock;
  } = {
    exec: jest.fn().mockResolvedValue(result),
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
  };
  query.populate.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('FeedbackService', () => {
  let service: FeedbackService;
  const feedbackModel = {
    create: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: getModelToken(Feedback.name), useValue: feedbackModel },
      ],
    }).compile();

    service = module.get(FeedbackService);
    jest.clearAllMocks();
  });

  it('stores a new note and only the ratings that were given', async () => {
    const createdAt = new Date('2026-04-01T00:00:00.000Z');
    feedbackModel.create.mockResolvedValue({
      id: 'feedback-1',
      text: 'The timer feels jumpy',
      ratings: { userInterface: 4, easeOfUse: 5 },
      createdAt,
    });

    const result = await service.create(USER_ID, {
      text: 'The timer feels jumpy',
      userInterface: 4,
      easeOfUse: 5,
    });

    expect(feedbackModel.create).toHaveBeenCalledWith({
      userId: new Types.ObjectId(USER_ID),
      text: 'The timer feels jumpy',
      ratings: { userInterface: 4, easeOfUse: 5 },
    });
    expect(result).toEqual({
      id: 'feedback-1',
      text: 'The timer feels jumpy',
      ratings: { userInterface: 4, easeOfUse: 5 },
      createdAt,
    });
  });

  it('rejects a submission with no note and no ratings', async () => {
    await expect(
      service.create(USER_ID, { text: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(feedbackModel.create).not.toHaveBeenCalled();
  });

  it('averages every stored star and skips blank categories', async () => {
    feedbackModel.aggregate.mockResolvedValue([
      {
        feedbackCount: 2,
        userInterfaceSum: 9,
        userInterfaceCount: 2,
        questionsSum: 4,
        questionsCount: 1,
        fullMockTestsSum: 0,
        fullMockTestsCount: 0,
        topicWisePracticeSum: 0,
        topicWisePracticeCount: 0,
        easeOfUseSum: 2,
        easeOfUseCount: 1,
      },
    ]);

    await expect(service.summary()).resolves.toEqual({
      feedbackCount: 2,
      overall: 3.8,
      ratedCount: 4,
      userInterface: { average: 4.5, count: 2 },
      questions: { average: 4, count: 1 },
      fullMockTests: { average: null, count: 0 },
      topicWisePractice: { average: null, count: 0 },
      easeOfUse: { average: 2, count: 1 },
    });
    expect(feedbackModel.aggregate).toHaveBeenCalledWith([
      {
        $group: expect.objectContaining({
          _id: null,
          feedbackCount: { $sum: 1 },
        }),
      },
    ]);
  });

  it('returns an empty summary when nobody has submitted feedback', async () => {
    feedbackModel.aggregate.mockResolvedValue([]);

    await expect(service.summary()).resolves.toEqual({
      feedbackCount: 0,
      overall: null,
      ratedCount: 0,
      userInterface: { average: null, count: 0 },
      questions: { average: null, count: 0 },
      fullMockTests: { average: null, count: 0 },
      topicWisePractice: { average: null, count: 0 },
      easeOfUse: { average: null, count: 0 },
    });
  });

  it('lists newest first and leaves a missing author as null', async () => {
    const createdAt = new Date('2026-04-02T00:00:00.000Z');
    const query = listChain([
      {
        id: 'feedback-1',
        text: 'Helpful mocks',
        ratings: { questions: 5 },
        userId: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
        createdAt,
      },
      {
        id: 'feedback-2',
        ratings: {},
        userId: new Types.ObjectId(USER_ID),
        createdAt,
      },
    ]);
    feedbackModel.find.mockReturnValue(query);
    feedbackModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });

    const result = await service.list(2, 500);

    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.skip).toHaveBeenCalledWith(100);
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(query.populate).toHaveBeenCalledWith('userId', 'name email');
    expect(result.pagination).toEqual({
      total: 2,
      page: 2,
      limit: 100,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: true,
    });
    expect(result.data[0].user).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'a***@example.com',
    });
    expect(result.data[1].user).toBeNull();
    expect(result.data[1].text).toBeNull();
  });

  it('clamps a non-finite limit to the default page size', async () => {
    const query = listChain([]);
    feedbackModel.find.mockReturnValue(query);
    feedbackModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    const result = await service.list(0, Number.NaN);

    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });
});
