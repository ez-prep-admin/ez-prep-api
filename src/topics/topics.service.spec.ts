import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { Topic } from './schemas/topic.schema';

const OID = '507f1f77bcf86cd799439011';

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

const topicDoc = (data: any) => ({
  ...data,
  toObject: () => ({
    ...data,
    _id: data._id || { toString: () => OID },
    id: data.id || OID,
  }),
});

describe('TopicsService', () => {
  let service: TopicsService;
  const model: any = jest.fn();
  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.find = jest.fn();
  model.create = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicsService,
        { provide: getModelToken(Topic.name), useValue: model },
      ],
    }).compile();
    service = module.get(TopicsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a topic', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(topicDoc({ name: 'Ratio' }));
      await expect(
        service.create({ name: 'Ratio' } as any),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException', async () => {
      model.findOne.mockReturnValue(chain({ name: 'Ratio' }));
      await expect(service.create({ name: 'Ratio' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns topics', async () => {
      model.find.mockReturnValue(chain([topicDoc({ name: 'Ratio' })]));
      expect(await service.findAll()).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns a topic', async () => {
      model.findById.mockReturnValue(chain(topicDoc({ name: 'Ratio' })));
      await expect(service.findOne(OID)).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      model.findById.mockReturnValue(chain(null));
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a topic', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.findByIdAndUpdate.mockReturnValue(
        chain(topicDoc({ name: 'Updated' })),
      );
      await expect(
        service.update(OID, { name: 'Updated' }),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException', async () => {
      model.findOne.mockReturnValue(chain({ name: 'Taken' }));
      await expect(service.update(OID, { name: 'Taken' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException', async () => {
      model.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.update(OID, { description: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes a topic', async () => {
      model.findByIdAndUpdate.mockReturnValue(
        chain(topicDoc({ isDeleted: true })),
      );
      await expect(service.remove(OID)).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      model.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
