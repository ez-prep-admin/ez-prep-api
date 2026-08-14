import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { Question } from '../mock-test-attempts/schemas/question.schema';
import { AwsConfigService } from '../aws/config/aws.config';

const OID = '507f1f77bcf86cd799439011';
const OID2 = '507f1f77bcf86cd799439012';

function chain(result: unknown) {
  const q: any = {
    exec: jest.fn().mockResolvedValue(result),
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    select: jest.fn(),
  };
  q.populate.mockReturnValue(q);
  q.sort.mockReturnValue(q);
  q.skip.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  q.lean.mockReturnValue(q);
  q.select.mockReturnValue(q);
  q.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

const questionDoc = (data: any = {}) => ({
  id: data.id || OID,
  _id: { toString: () => OID },
  toObject: () => ({
    id: OID,
    questionText: data.questionText || { en: { text: 'Q?' } },
    optionType: 'text',
    options: data.options || [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ],
    explanation: data.explanation,
    correctAnswer: 'a',
    subject: data.subject || { id: OID, name: 'QA' },
    topic: data.topic || OID,
    exams: data.exams || [{ _id: { toString: () => OID2 }, name: 'SBI PO' }, null],
    tag: data.tag || { toString: () => OID },
    difficultyLevel: 'easy',
    source: 'MANUAL_INPUT',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
});

describe('QuestionsService', () => {
  let service: QuestionsService;
  const questionModel: any = jest.fn();
  questionModel.create = jest.fn();
  questionModel.find = jest.fn();
  questionModel.findOne = jest.fn();
  questionModel.findOneAndUpdate = jest.fn();
  questionModel.countDocuments = jest.fn();

  const awsConfig = {
    region: 'ap-south-1',
    allowedImageBuckets: ['img-bucket'],
  };

  const baseDto = {
    questionText: { en: { text: 'Q?' }, ml: { text: 'Q ml' } },
    optionType: 'text' as const,
    options: [
      { id: 'a', type: 'text' as const, en: 'A' },
      { id: 'b', type: 'text' as const, en: 'B' },
      { id: 'c', type: 'text' as const, en: 'C' },
      { id: 'd', type: 'text' as const, en: 'D' },
    ],
    correctAnswer: 'a',
    explanation: { en: 'because', images: [] },
    subject: OID,
    topic: OID2,
    exams: [OID],
    tag: OID,
    difficultyLevel: 'easy' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: getModelToken(Question.name), useValue: questionModel },
        { provide: AwsConfigService, useValue: awsConfig },
      ],
    }).compile();
    service = module.get(QuestionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a question then reloads it', async () => {
      questionModel.create.mockResolvedValue({ id: OID });
      questionModel.findOne.mockReturnValue(chain(questionDoc()));
      await expect(service.create(baseDto as any)).resolves.toMatchObject({
        id: OID,
        correctAnswer: 'a',
      });
    });

    it('throws when correctAnswer does not match an option', async () => {
      await expect(
        service.create({ ...baseDto, correctAnswer: 'z' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('sanitizes allowed images', async () => {
      questionModel.create.mockResolvedValue({ id: OID });
      questionModel.findOne.mockReturnValue(chain(questionDoc()));
      await service.create({
        ...baseDto,
        questionText: {
          en: {
            text: 'Q?',
            image: { key: 'admin-images/a.png', bucket: 'img-bucket' },
          },
        },
        options: baseDto.options.map(o => ({
          ...o,
          image: { key: 'question-imports/o.png', bucket: 'img-bucket' },
        })),
        explanation: {
          en: 'e',
          image: { key: 'admin-images/e.png', bucket: 'img-bucket' },
          images: [{ key: 'admin-images/e2.png', bucket: 'img-bucket' }],
        },
      } as any);
      expect(questionModel.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated questions', async () => {
      questionModel.find.mockReturnValue(chain([questionDoc()]));
      questionModel.countDocuments.mockReturnValue(chain(1));
      const result = await service.findAll(1, 10, OID, OID2, OID);
      expect(result.data).toHaveLength(1);
    });

    it('throws on invalid subject ID', async () => {
      await expect(service.findAll(1, 10, 'bad')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws on invalid topic ID', async () => {
      await expect(service.findAll(1, 10, undefined, 'bad')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws on invalid exam ID', async () => {
      await expect(
        service.findAll(1, 10, undefined, undefined, 'bad'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns a question', async () => {
      questionModel.findOne.mockReturnValue(chain(questionDoc()));
      await expect(service.findOne(OID)).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      questionModel.findOne.mockReturnValue(chain(null));
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates a question including null topic/tag', async () => {
      questionModel.findOneAndUpdate.mockReturnValue(chain(questionDoc()));
      await expect(
        service.update(OID, {
          ...baseDto,
          topic: null,
          tag: null,
        } as any),
      ).resolves.toBeDefined();
    });

    it('throws when options length is not 4', async () => {
      await expect(
        service.update(OID, { options: [{ id: 'a' }] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException', async () => {
      questionModel.findOneAndUpdate.mockReturnValue(chain(null));
      await expect(service.update(OID, { explanation: { en: 'x' } })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes a question', async () => {
      questionModel.findOneAndUpdate.mockReturnValue(chain(questionDoc()));
      await expect(service.remove(OID)).resolves.toEqual({
        message: 'Question deleted successfully',
      });
    });

    it('throws NotFoundException', async () => {
      questionModel.findOneAndUpdate.mockReturnValue(chain(null));
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
