import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurrentAffairsService } from './current-affairs.service';
import { CurrentAffair } from './schemas/current-affair.schema';
import { ImageUrlResolver } from '../aws/s3/image-url.resolver';

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

const doc = (data: Record<string, unknown> = {}) => {
  const payload = {
    id: (data.id as string) || 'ca1',
    title: 'Satellite launch',
    description: 'ISRO launch',
    memoryTrick: 'sky report',
    dateKey: '2026-08-14',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-08-14T10:00:00.000Z'),
    updatedAt: new Date('2026-08-14T10:00:00.000Z'),
    ...data,
  };
  return {
    ...payload,
    toObject: () => ({ ...payload }),
  };
};

const imageMeta = {
  key: 'admin-images/file.png',
  bucket: 'ez-prep-assets',
  region: 'ap-south-1',
  contentType: 'image/png',
  size: 100,
  lastModified: '2026-08-14T10:00:00.000Z',
  url: 'https://expired.example/file.png',
};

describe('CurrentAffairsService', () => {
  let service: CurrentAffairsService;
  const model: any = jest.fn();
  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.find = jest.fn();
  model.create = jest.fn();
  model.countDocuments = jest.fn();

  const imageUrlResolver = {
    resolve: jest.fn(),
    resolveMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrentAffairsService,
        { provide: getModelToken(CurrentAffair.name), useValue: model },
        { provide: ImageUrlResolver, useValue: imageUrlResolver },
      ],
    }).compile();
    service = module.get(CurrentAffairsService);
    jest.clearAllMocks();
    imageUrlResolver.resolve.mockResolvedValue(null);
    imageUrlResolver.resolveMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates the first item of the day with sortOrder 0', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(doc({ sortOrder: 0 }));

      const result = await service.create({
        title: 'Satellite launch',
        description: 'ISRO launch',
        date: '2026-08-14',
      } as any);

      expect(model.create).toHaveBeenCalledWith({
        title: 'Satellite launch',
        description: 'ISRO launch',
        memoryTrick: undefined,
        dateKey: '2026-08-14',
        sortOrder: 0,
      });
      expect(result.date).toBe('2026-08-14');
      expect(result.sortOrder).toBe(0);
      expect(imageUrlResolver.resolve).toHaveBeenCalled();
    });

    it('appends after the last sortOrder for that date', async () => {
      model.findOne.mockReturnValue(chain({ sortOrder: 4 }));
      model.create.mockResolvedValue(doc({ sortOrder: 5 }));

      await service.create({
        title: 'Second item',
        description: 'Follow up',
        date: '2026-08-14',
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 5 }),
      );
    });

    it('stores image metadata without the ephemeral url', async () => {
      model.findOne.mockReturnValue(chain(null));
      const created = doc({
        image: {
          key: imageMeta.key,
          bucket: imageMeta.bucket,
          region: imageMeta.region,
          contentType: imageMeta.contentType,
          size: imageMeta.size,
          lastModified: new Date(imageMeta.lastModified),
        },
      });
      model.create.mockResolvedValue(created);
      imageUrlResolver.resolve.mockResolvedValue(
        'https://signed.example/file.png',
      );

      const result = await service.create({
        title: 'Satellite launch',
        description: 'ISRO launch',
        date: '2026-08-14',
        memoryTrick: 'sky report',
        image: imageMeta,
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryTrick: 'sky report',
          image: expect.objectContaining({
            key: imageMeta.key,
            bucket: imageMeta.bucket,
            region: imageMeta.region,
            lastModified: new Date(imageMeta.lastModified),
          }),
        }),
      );
      expect(model.create.mock.calls[0][0].image.url).toBeUndefined();
      expect(result.imageUrl).toBe('https://signed.example/file.png');
    });

    it('stores image metadata without lastModified when omitted', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(doc());

      await service.create({
        title: 'Satellite launch',
        description: 'ISRO launch',
        date: '2026-08-14',
        image: {
          key: 'k',
          bucket: 'b',
          region: 'ap-south-1',
        },
      } as any);

      expect(model.create.mock.calls[0][0].image.lastModified).toBeUndefined();
    });

    it('omits invalid lastModified instead of storing Invalid Date', async () => {
      model.findOne.mockReturnValue(chain(null));
      model.create.mockResolvedValue(doc());

      await service.create({
        title: 'Satellite launch',
        description: 'ISRO launch',
        date: '2026-08-14',
        image: {
          key: 'k',
          bucket: 'b',
          region: 'ap-south-1',
          lastModified: 'not-a-date',
        },
      } as any);

      expect(model.create.mock.calls[0][0].image.lastModified).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns paginated items without a date filter', async () => {
      const items = [doc()];
      model.find.mockReturnValue(chain(items));
      model.countDocuments.mockReturnValue(chain(1));
      imageUrlResolver.resolveMany.mockResolvedValue([
        'https://signed.example/file.png',
      ]);

      const result = await service.findAll();

      expect(model.find).toHaveBeenCalledWith({
        isDeleted: { $ne: true },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].imageUrl).toBe('https://signed.example/file.png');
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('filters by date, search, and activeOnly', async () => {
      model.find.mockReturnValue(chain([]));
      model.countDocuments.mockReturnValue(chain(0));
      imageUrlResolver.resolveMany.mockResolvedValue([]);

      await service.findAll(1, 10, '2026-08-14', '  satellite  ', true);

      expect(model.find).toHaveBeenCalledWith({
        isDeleted: { $ne: true },
        dateKey: '2026-08-14',
        isActive: true,
        $text: { $search: 'satellite' },
      });
      expect(model.find().sort).toHaveBeenCalledWith({
        sortOrder: 1,
        createdAt: 1,
      });
    });

    it('sorts by dateKey when no date filter is provided', async () => {
      model.find.mockReturnValue(chain([]));
      model.countDocuments.mockReturnValue(chain(0));
      imageUrlResolver.resolveMany.mockResolvedValue([]);

      await service.findAll(1, 10, undefined, '   ');

      expect(model.find().sort).toHaveBeenCalledWith({
        dateKey: -1,
        sortOrder: 1,
        createdAt: 1,
      });
    });

    it('rejects an invalid date query', async () => {
      await expect(service.findAll(1, 10, '2026-02-31')).rejects.toThrow(
        BadRequestException,
      );
      expect(model.find).not.toHaveBeenCalled();
    });

    it('clamps page and limit and reports pagination flags', async () => {
      model.find.mockReturnValue(chain([doc()]));
      model.countDocuments.mockReturnValue(chain(250));
      imageUrlResolver.resolveMany.mockResolvedValue([null]);

      const result = await service.findAll(0, 200);

      expect(model.find().skip).toHaveBeenCalledWith(0);
      expect(model.find().limit).toHaveBeenCalledWith(100);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(100);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);
      expect(result.data[0].imageUrl).toBeUndefined();
    });

    it('sets hasPrevPage on later pages', async () => {
      model.find.mockReturnValue(chain([]));
      model.countDocuments.mockReturnValue(chain(30));
      imageUrlResolver.resolveMany.mockResolvedValue([]);

      const result = await service.findAll(2, 10);
      expect(result.pagination.hasPrevPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });

  describe('findOne', () => {
    it('returns a mapped item', async () => {
      model.findById.mockReturnValue(chain(doc()));
      imageUrlResolver.resolve.mockResolvedValue(null);

      const result = await service.findOne('ca1');
      expect(result.id).toBe('ca1');
      expect(result.date).toBe('2026-08-14');
    });

    it('throws NotFoundException', async () => {
      model.findById.mockReturnValue(chain(null));
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws when the item does not exist', async () => {
      model.findById.mockReturnValue(chain(null));
      await expect(
        service.update('missing', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates scalar fields without moving the date', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findByIdAndUpdate.mockReturnValue(
        chain(doc({ title: 'Updated', description: 'New copy' })),
      );

      await service.update('ca1', {
        title: 'Updated',
        description: 'New copy',
        memoryTrick: 'new trick',
        isActive: false,
        sortOrder: 3,
      });

      expect(model.findOne).not.toHaveBeenCalled();
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        {
          $set: {
            title: 'Updated',
            description: 'New copy',
            memoryTrick: 'new trick',
            isActive: false,
            sortOrder: 3,
          },
        },
        { new: true },
      );
    });

    it('does not change dateKey when the same date is sent', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findByIdAndUpdate.mockReturnValue(chain(doc()));

      await service.update('ca1', { date: '2026-08-14' });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        {},
        { new: true },
      );
    });

    it('rejects an invalid date', async () => {
      model.findById.mockReturnValue(chain(doc()));
      await expect(
        service.update('ca1', { date: '2026-02-31' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('moves the item to another day and appends sortOrder', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findOne.mockReturnValue(chain({ sortOrder: 1 }));
      model.findByIdAndUpdate.mockReturnValue(
        chain(doc({ dateKey: '2026-08-15', sortOrder: 2 })),
      );

      await service.update('ca1', { date: '2026-08-15' });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        {
          $set: {
            dateKey: '2026-08-15',
            sortOrder: 2,
          },
        },
        { new: true },
      );
    });

    it('keeps an explicit sortOrder when moving to another day', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findByIdAndUpdate.mockReturnValue(
        chain(doc({ dateKey: '2026-08-15', sortOrder: 0 })),
      );

      await service.update('ca1', { date: '2026-08-15', sortOrder: 0 });

      expect(model.findOne).not.toHaveBeenCalled();
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        {
          $set: {
            sortOrder: 0,
            dateKey: '2026-08-15',
          },
        },
        { new: true },
      );
    });

    it('replaces image metadata', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findByIdAndUpdate.mockReturnValue(chain(doc()));

      await service.update('ca1', { image: imageMeta } as any);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        {
          $set: {
            image: expect.objectContaining({
              key: imageMeta.key,
              bucket: imageMeta.bucket,
            }),
          },
        },
        { new: true },
      );
    });

    it('unsets image when null is sent', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findByIdAndUpdate.mockReturnValue(chain(doc({ image: undefined })));

      await service.update('ca1', { image: null });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        { $unset: { image: 1 } },
        { new: true },
      );
    });

    it('throws when the update races and the document disappears', async () => {
      model.findById.mockReturnValue(chain(doc()));
      model.findByIdAndUpdate.mockReturnValue(chain(null));

      await expect(
        service.update('ca1', { title: 'Gone' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft deletes the item', async () => {
      model.findByIdAndUpdate.mockReturnValue(
        chain(doc({ isDeleted: true, isActive: false })),
      );

      const result = await service.remove('ca1');
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'ca1',
        { isDeleted: true, isActive: false },
        { new: true },
      );
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException', async () => {
      model.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
