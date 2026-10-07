import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { GrantValidationService } from './grant-validation.service';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';
import { ProductVersion } from './schemas/product-version.schema';

const PRODUCT_ID = '507f1f77bcf86cd799439021';
const GROUP_ID = '507f1f77bcf86cd799439022';
const EXAM_ID = '507f1f77bcf86cd799439023';
const ADMIN_ID = '507f1f77bcf86cd799439024';

function productDoc(overrides: Record<string, unknown> = {}) {
  const grants = (overrides.grants as Array<{
    scopeType: EntitlementScopeType;
    scopeId: Types.ObjectId;
  }>) ?? [
    {
      scopeType: EntitlementScopeType.EXAM_GROUP,
      scopeId: new Types.ObjectId(GROUP_ID),
    },
  ];

  const doc: any = {
    _id: new Types.ObjectId(PRODUCT_ID),
    code: 'SSC_CGL_COMPLETE',
    name: 'SSC CGL Complete',
    description: 'Full pack',
    status: ProductStatus.DRAFT,
    version: 0,
    grants,
    isDeleted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };

  doc.save = jest.fn().mockImplementation(async () => doc);
  doc.toObject = () => ({
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    version: doc.version,
    grants: doc.grants,
    display: doc.display,
    metadata: doc.metadata,
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });

  return doc;
}

function versionDoc(overrides: Record<string, unknown> = {}) {
  const doc: any = {
    _id: new Types.ObjectId(),
    productId: new Types.ObjectId(PRODUCT_ID),
    version: 1,
    code: 'SSC_CGL_COMPLETE',
    name: 'SSC CGL Complete',
    description: 'Full pack',
    grants: [
      {
        scopeType: EntitlementScopeType.EXAM_GROUP,
        scopeId: new Types.ObjectId(GROUP_ID),
      },
    ],
    frozenAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
  doc.toObject = () => ({
    id: String(doc._id),
    productId: doc.productId,
    version: doc.version,
    code: doc.code,
    name: doc.name,
    description: doc.description,
    grants: doc.grants,
    frozenAt: doc.frozenAt,
    publishedBy: doc.publishedBy,
  });
  return doc;
}

describe('ProductsService', () => {
  let service: ProductsService;

  const productModel: any = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const productVersionModel: any = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const grantValidation = {
    assertGrantsValid: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: productModel },
        {
          provide: getModelToken(ProductVersion.name),
          useValue: productVersionModel,
        },
        { provide: GrantValidationService, useValue: grantValidation },
      ],
    }).compile();

    service = module.get(ProductsService);
    jest.clearAllMocks();
    grantValidation.assertGrantsValid.mockResolvedValue(undefined);
  });

  describe('create + publish happy path', () => {
    it('creates DRAFT then publishes with version 1 and product_versions row', async () => {
      productModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(null),
      });
      const draft = productDoc();
      productModel.create.mockResolvedValue(draft);

      const created = await service.create(
        {
          code: 'SSC_CGL_COMPLETE',
          name: 'SSC CGL Complete',
          description: 'Full pack',
          grants: [
            {
              scopeType: EntitlementScopeType.EXAM_GROUP,
              scopeId: GROUP_ID,
            },
          ],
        },
        ADMIN_ID,
      );
      expect(created.status).toBe(ProductStatus.DRAFT);
      expect(created.version).toBe(0);

      const live = productDoc({ status: ProductStatus.DRAFT, version: 0 });
      productModel.findById.mockReturnValue({
        exec: () => Promise.resolve(live),
      });
      productVersionModel.findOne.mockReturnValue({
        sort: () => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
      });
      productVersionModel.create.mockResolvedValue(versionDoc());

      const published = await service.publish(PRODUCT_ID, ADMIN_ID);

      expect(grantValidation.assertGrantsValid).toHaveBeenCalled();
      expect(published.status).toBe(ProductStatus.PUBLISHED);
      expect(published.version).toBe(1);
      expect(productVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          code: 'SSC_CGL_COMPLETE',
        }),
      );
    });
  });

  describe('publish validation', () => {
    it('fails when grant scopeId is invalid and does not write version', async () => {
      const live = productDoc();
      productModel.findById.mockReturnValue({
        exec: () => Promise.resolve(live),
      });
      grantValidation.assertGrantsValid.mockRejectedValue(
        new BadRequestException(`EXAM_GROUP with ID "${GROUP_ID}" not found`),
      );

      await expect(
        service.publish(PRODUCT_ID, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(productVersionModel.create).not.toHaveBeenCalled();
    });
  });

  describe('version bump on grant change', () => {
    it('increments version and keeps prior version document unchanged', async () => {
      const v1 = versionDoc({ version: 1 });
      const live = productDoc({
        status: ProductStatus.PUBLISHED,
        version: 1,
        grants: [
          {
            scopeType: EntitlementScopeType.EXAM,
            scopeId: new Types.ObjectId(EXAM_ID),
          },
        ],
      });

      productModel.findById.mockReturnValue({
        exec: () => Promise.resolve(live),
      });
      productVersionModel.findOne.mockReturnValue({
        sort: () => ({
          lean: () => ({ exec: () => Promise.resolve(v1) }),
        }),
      });
      productVersionModel.create.mockResolvedValue(
        versionDoc({
          version: 2,
          grants: [
            {
              scopeType: EntitlementScopeType.EXAM,
              scopeId: new Types.ObjectId(EXAM_ID),
            },
          ],
        }),
      );

      const published = await service.publish(PRODUCT_ID, ADMIN_ID);

      expect(published.version).toBe(2);
      expect(productVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 2 }),
      );
      // Prior frozen snapshot is never updated — only create is used
      expect(productVersionModel.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('listVersions', () => {
    it('returns v1 and v2 after republish', async () => {
      productModel.findById.mockReturnValue({
        exec: () =>
          Promise.resolve(productDoc({ status: ProductStatus.PUBLISHED })),
      });
      const v1 = versionDoc({ version: 1 });
      const v2 = versionDoc({
        version: 2,
        grants: [
          {
            scopeType: EntitlementScopeType.EXAM,
            scopeId: new Types.ObjectId(EXAM_ID),
          },
        ],
      });
      productVersionModel.find.mockReturnValue({
        sort: () => ({
          exec: () => Promise.resolve([v1, v2]),
        }),
      });

      const versions = await service.listVersions(PRODUCT_ID);
      expect(versions.map(v => v.version)).toEqual([1, 2]);
    });
  });

  describe('archive', () => {
    it('archives a published product', async () => {
      const live = productDoc({ status: ProductStatus.PUBLISHED, version: 1 });
      productModel.findById.mockReturnValue({
        exec: () => Promise.resolve(live),
      });

      const result = await service.archive(PRODUCT_ID, ADMIN_ID);
      expect(result.status).toBe(ProductStatus.ARCHIVED);
    });
  });

  describe('duplicate code conflict', () => {
    it('rejects duplicate product code', async () => {
      productModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(productDoc()),
      });

      await expect(
        service.create({
          code: 'SSC_CGL_COMPLETE',
          name: 'Other',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne not found', () => {
    it('throws NotFoundException', async () => {
      productModel.findById.mockReturnValue({
        exec: () => Promise.resolve(null),
      });
      await expect(service.findOne(PRODUCT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
