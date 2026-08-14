import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FailedQuestionService } from './failed-question.service';
import { FailedQuestion } from '../schemas/failed-question.schema';
import { RejectedQuestion } from '../types/import-question';

const uploadId = '507f1f77bcf86cd799439011';
const failedId = '507f1f77bcf86cd799439022';

function chainable(result: unknown) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

describe('FailedQuestionService', () => {
  let service: FailedQuestionService;
  const model: any = {
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FailedQuestionService,
        { provide: getModelToken(FailedQuestion.name), useValue: model },
      ],
    }).compile();
    service = module.get(FailedQuestionService);
  });

  it('replaceForUpload deletes existing rows and returns when none rejected', async () => {
    model.deleteMany.mockResolvedValue({});
    await service.replaceForUpload(uploadId, []);
    expect(model.deleteMany).toHaveBeenCalled();
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('replaceForUpload inserts rejected questions', async () => {
    model.deleteMany.mockResolvedValue({});
    model.insertMany.mockResolvedValue([]);
    const rejected: RejectedQuestion[] = [
      {
        number: 3,
        stage: 'llm',
        message: 'failed',
        matchedQuestion: { number: 3, question: 'q' },
        questionDraft: { subject: 's' } as never,
      },
    ];

    await service.replaceForUpload(uploadId, rejected);

    expect(model.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          questionNumber: 3,
          failureStage: 'llm',
        }),
      ]),
    );
  });

  it('listPaginated clamps page/limit and applies filters', async () => {
    const docs = [{ questionNumber: 1 }];
    model.find.mockReturnValue(chainable(docs));
    model.countDocuments.mockResolvedValue(1);

    const result = await service.listPaginated(0, 500, {
      subjectId: uploadId,
      topicId: uploadId,
      examId: uploadId,
    });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.docs).toBe(docs);
    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        'questionDraft.subject': uploadId,
        'questionDraft.topic': uploadId,
        'questionDraft.exams': uploadId,
      }),
    );
  });

  it('listByUpload sorts by question number', async () => {
    model.find.mockReturnValue(chainable([]));
    await service.listByUpload(uploadId);
    expect(model.find).toHaveBeenCalled();
  });

  it('findByIdOrThrow validates id and missing docs', async () => {
    await expect(service.findByIdOrThrow('bad')).rejects.toThrow(
      BadRequestException,
    );

    model.findById.mockResolvedValue(null);
    await expect(service.findByIdOrThrow(failedId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteByIdOrThrow and deleteById remove the document', async () => {
    const doc = {
      _id: failedId,
      uploadId: { toString: () => uploadId },
      questionNumber: 4,
    };
    model.findById.mockResolvedValue(doc);
    model.deleteOne.mockResolvedValue({});

    const deleted = await service.deleteByIdOrThrow(failedId);
    expect(deleted).toBe(doc);
    await service.deleteById(failedId);
    expect(model.deleteOne).toHaveBeenCalled();
  });

  it('countByUpload uses countDocuments', async () => {
    model.countDocuments.mockResolvedValue(7);
    await expect(service.countByUpload(uploadId)).resolves.toBe(7);
  });
});
