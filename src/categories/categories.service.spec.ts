import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './schemas/category.schema';

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

const doc = (data: any) => ({
  ...data,
  toObject: () => ({ ...data, id: data._id || 'c1' }),
});

describe('CategoriesService', () => {
  let service: CategoriesService;
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
        CategoriesService,
        { provide: getModelToken(Category.name), useValue: model },
      ],
    }).compile();
    service = module.get(CategoriesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a category', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(
        doc({ name: 'Banking', shortName: 'BANK' }),
      );
      await expect(
        service.create({ name: 'Banking', shortName: 'BANK' } as any),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException on duplicate', async () => {
      model.findOne.mockReturnValue(chain({ name: 'Banking' }));
      await expect(
        service.create({ name: 'Banking', shortName: 'BANK' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated categories', async () => {
      model.find.mockReturnValue(chain([doc({ name: 'Banking' })]));
      model.countDocuments.mockReturnValue(chain(1));
      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('applies search and activeOnly filters', async () => {
      model.find.mockReturnValue(chain([]));
      model.countDocuments.mockReturnValue(chain(0));
      await service.findAll(0, 200, '  bank  ', true);
      expect(model.find).toHaveBeenCalledWith({
        isActive: true,
        $text: { $search: 'bank' },
      });
    });
  });

  describe('findOne', () => {
    it('returns a category', async () => {
      model.findById.mockReturnValue(chain(doc({ name: 'Banking' })));
      await expect(service.findOne('c1')).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      model.findById.mockReturnValue(chain(null));
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByShortName', () => {
    it('uppercases the short name', async () => {
      model.findOne.mockReturnValue(chain(doc({ shortName: 'BANK' })));
      await service.findByShortName('bank');
      expect(model.findOne).toHaveBeenCalledWith({ shortName: 'BANK' });
    });

    it('throws NotFoundException', async () => {
      model.findOne.mockReturnValue(chain(null));
      await expect(service.findByShortName('X')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a category', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.findByIdAndUpdate.mockReturnValue(
        chain(doc({ name: 'Updated', shortName: 'UPD' })),
      );
      await expect(
        service.update('c1', { name: 'Updated', shortName: 'UPD' }),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException on duplicate name', async () => {
      model.findOne.mockReturnValue(chain({ name: 'Taken' }));
      await expect(service.update('c1', { name: 'Taken' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException', async () => {
      model.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.update('c1', { description: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes a category', async () => {
      model.findByIdAndUpdate.mockReturnValue(chain(doc({ isDeleted: true })));
      await expect(service.remove('c1')).resolves.toBeDefined();
    });

    it('throws NotFoundException', async () => {
      model.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findActiveCategories', () => {
    it('returns active categories', async () => {
      model.find.mockReturnValue(
        chain([doc({ name: 'Banking', isActive: true })]),
      );
      const result = await service.findActiveCategories();
      expect(result).toHaveLength(1);
    });
  });
});
