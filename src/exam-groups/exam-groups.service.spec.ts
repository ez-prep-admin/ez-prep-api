import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExamGroupsService } from './exam-groups.service';
import { ExamGroup } from './schemas/exam-group.schema';

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

const groupDoc = (data: any) => ({
  ...data,
  toObject: () => ({
    id: data.id || OID,
    name: data.name,
    shortName: data.shortName,
    description: data.description,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    category: data.category,
  }),
});

describe('ExamGroupsService', () => {
  let service: ExamGroupsService;
  const model: any = jest.fn();
  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.find = jest.fn();
  model.create = jest.fn();
  model.countDocuments = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamGroupsService,
        { provide: getModelToken(ExamGroup.name), useValue: model },
      ],
    }).compile();
    service = module.get(ExamGroupsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates an exam group', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(groupDoc({ name: 'UPSC CSE' }));
      await expect(
        service.create({ name: 'UPSC CSE', category: OID } as any),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException', async () => {
      model.findOne.mockReturnValue(chain({ name: 'UPSC CSE' }));
      await expect(
        service.create({ name: 'UPSC CSE', category: OID } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated groups', async () => {
      model.find.mockReturnValue(chain([groupDoc({ name: 'UPSC CSE' })]));
      model.countDocuments.mockReturnValue(chain(1));
      const result = await service.findAll(1, 10, 'upsc', OID, true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns a group', async () => {
      model.findById.mockReturnValue(chain(groupDoc({ name: 'UPSC CSE' })));
      await expect(service.findOne(OID)).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      model.findById.mockReturnValue(chain(null));
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCategory', () => {
    it('returns groups for a category', async () => {
      model.find.mockReturnValue(chain([groupDoc({ name: 'CGL' })]));
      const result = await service.findByCategory(OID);
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates a group', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.findByIdAndUpdate.mockReturnValue(
        chain(groupDoc({ name: 'Updated' })),
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
    it('soft deletes a group', async () => {
      model.findByIdAndUpdate.mockReturnValue(
        chain(groupDoc({ isDeleted: true })),
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

  describe('findActiveExamGroups', () => {
    it('returns active groups', async () => {
      model.find.mockReturnValue(
        chain([groupDoc({ name: 'CGL', isActive: true })]),
      );
      const result = await service.findActiveExamGroups();
      expect(result).toHaveLength(1);
    });
  });

  describe('findGroupedByCategory', () => {
    it('groups exam groups under categories', async () => {
      const category = {
        _id: { toString: () => OID },
        toObject: () => ({
          name: 'SSC',
          shortName: 'SSC',
          imageUrl: 'img',
          description: 'desc',
        }),
      };
      const group = groupDoc({
        id: OID,
        name: 'CGL',
        shortName: 'CGL',
        category,
      });
      group.category = category;
      const orphan = groupDoc({ name: 'Orphan', category: null });
      orphan.category = null;

      model.find.mockReturnValue(chain([group, orphan, group]));
      const result = await service.findGroupedByCategory();
      expect(result).toHaveLength(1);
      expect(result[0].examGroups).toHaveLength(2);
    });
  });
});
