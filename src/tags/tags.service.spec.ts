import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { Tag } from './schemas/tag.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import { Topic } from '../topics/schemas/topic.schema';

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

const tagDoc = (data: any) => ({
  ...data,
  _id: data._id || { toString: () => OID },
  save: jest.fn().mockResolvedValue(undefined),
  toObject: () => ({
    name: data.name,
    description: data.description,
    subject: data.subject || OID,
    topic: data.topic || OID2,
    isActive: data.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
});

describe('TagsService', () => {
  let service: TagsService;
  const tagModel: any = jest
    .fn()
    .mockImplementation(() => tagDoc({ name: 'Easy' }));
  tagModel.findOne = jest.fn();
  tagModel.findById = jest.fn();
  tagModel.findByIdAndUpdate = jest.fn();
  tagModel.find = jest.fn();
  tagModel.countDocuments = jest.fn();

  const subjectModel: any = { findById: jest.fn() };
  const topicModel: any = { findById: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getModelToken(Tag.name), useValue: tagModel },
        { provide: getModelToken(Subject.name), useValue: subjectModel },
        { provide: getModelToken(Topic.name), useValue: topicModel },
      ],
    }).compile();
    service = module.get(TagsService);
    jest.clearAllMocks();
    tagModel.mockImplementation(() => tagDoc({ name: 'Easy' }));
  });

  describe('create', () => {
    const dto = { name: 'Easy', subject: OID, topic: OID2 };

    it('creates a tag', async () => {
      subjectModel.findById.mockResolvedValue({ _id: OID });
      topicModel.findById.mockResolvedValue({ _id: OID2 });
      tagModel.findOne.mockResolvedValue(null);
      await expect(service.create(dto as any)).resolves.toBeDefined();
    });

    it('throws when subject is missing', async () => {
      subjectModel.findById.mockResolvedValue(null);
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when topic is missing', async () => {
      subjectModel.findById.mockResolvedValue({ _id: OID });
      topicModel.findById.mockResolvedValue(null);
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException', async () => {
      subjectModel.findById.mockResolvedValue({ _id: OID });
      topicModel.findById.mockResolvedValue({ _id: OID2 });
      tagModel.findOne.mockResolvedValue({ name: 'Easy' });
      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated tags', async () => {
      tagModel.find.mockReturnValue(chain([tagDoc({ name: 'Easy' })]));
      tagModel.countDocuments.mockReturnValue(chain(1));
      const result = await service.findAll(1, 10, OID, OID2);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns a tag', async () => {
      tagModel.findById.mockReturnValue(chain(tagDoc({ name: 'Easy' })));
      await expect(service.findOne(OID)).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      tagModel.findById.mockReturnValue(chain(null));
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a tag', async () => {
      subjectModel.findById.mockResolvedValue({ _id: OID });
      topicModel.findById.mockResolvedValue({ _id: OID2 });
      tagModel.findById.mockResolvedValue(
        tagDoc({ name: 'Easy', subject: OID, topic: OID2 }),
      );
      tagModel.findOne.mockResolvedValue(null);
      tagModel.findByIdAndUpdate.mockReturnValue(
        chain(tagDoc({ name: 'Hard' })),
      );
      await expect(
        service.update(OID, { name: 'Hard', subject: OID, topic: OID2 }),
      ).resolves.toBeDefined();
    });

    it('throws when subject is missing', async () => {
      subjectModel.findById.mockResolvedValue(null);
      await expect(service.update(OID, { subject: OID })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when topic is missing', async () => {
      topicModel.findById.mockResolvedValue(null);
      await expect(service.update(OID, { topic: OID2 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when tag missing during duplicate check', async () => {
      tagModel.findById.mockResolvedValue(null);
      await expect(service.update(OID, { name: 'Hard' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException', async () => {
      tagModel.findById.mockResolvedValue(
        tagDoc({ name: 'Easy', subject: OID, topic: OID2 }),
      );
      tagModel.findOne.mockResolvedValue({ name: 'Hard' });
      await expect(service.update(OID, { name: 'Hard' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when update returns null', async () => {
      tagModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(
        service.update(OID, { description: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft deletes a tag', async () => {
      tagModel.findByIdAndUpdate.mockReturnValue(
        chain(tagDoc({ isDeleted: true })),
      );
      await expect(service.remove(OID)).resolves.toEqual({
        message: 'Tag deleted successfully',
      });
    });

    it('throws NotFoundException', async () => {
      tagModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
