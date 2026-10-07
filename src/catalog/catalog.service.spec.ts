import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { Exam } from '../exams/schemas/exam.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';
import { OffersService } from '../offers/offers.service';
import { ProductsService } from '../products/products.service';
import { CatalogService } from './catalog.service';

const PRODUCT_ID = '507f1f77bcf86cd799439041';
const GROUP_ID = '507f1f77bcf86cd799439042';
const EXAM_ID = '507f1f77bcf86cd799439043';
const MOCK_ID = '507f1f77bcf86cd799439044';
const MOCK_PRODUCT_ID = '507f1f77bcf86cd799439045';

function publishedProductDoc(
  id: string,
  grants: Array<{ scopeType: EntitlementScopeType; scopeId: Types.ObjectId }>,
) {
  const doc: any = {
    _id: new Types.ObjectId(id),
    code: 'PACK',
    name: 'Pack',
    status: ProductStatus.PUBLISHED,
    version: 1,
    grants,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  doc.toObject = () => ({
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    status: doc.status,
    version: doc.version,
    grants: doc.grants,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
  return doc;
}

describe('CatalogService', () => {
  let service: CatalogService;

  const productsService = {
    listPublished: jest.fn(),
    findPublished: jest.fn(),
    findPublishedByGrantMatchers: jest.fn(),
    toProductResponse: jest.fn((p: any) => ({
      id: String(p._id),
      code: p.code,
      name: p.name,
      status: p.status,
      version: p.version,
      grants: (p.grants ?? []).map((g: any) => ({
        scopeType: g.scopeType,
        scopeId: String(g.scopeId),
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };

  const offersService = {
    listActiveByProduct: jest.fn(),
    listActiveByProductIds: jest.fn(),
  };

  const examModel: any = { findById: jest.fn() };
  const mockTestModel: any = { findById: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: ProductsService, useValue: productsService },
        { provide: OffersService, useValue: offersService },
        { provide: getModelToken(Exam.name), useValue: examModel },
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
      ],
    }).compile();

    service = module.get(CatalogService);
    jest.clearAllMocks();
  });

  describe('forExam', () => {
    it('includes EXAM_GROUP pack covering the exam', async () => {
      examModel.findById.mockReturnValue({
        select: () => ({
          lean: () =>
            Promise.resolve({
              _id: EXAM_ID,
              examGroup: new Types.ObjectId(GROUP_ID),
            }),
        }),
      });

      const groupPack = publishedProductDoc(PRODUCT_ID, [
        {
          scopeType: EntitlementScopeType.EXAM_GROUP,
          scopeId: new Types.ObjectId(GROUP_ID),
        },
      ]);
      productsService.findPublishedByGrantMatchers.mockResolvedValue([
        groupPack,
      ]);
      offersService.listActiveByProductIds.mockResolvedValue(
        new Map([
          [
            PRODUCT_ID,
            [
              {
                id: 'offer1',
                productId: PRODUCT_ID,
                durationPreset: DurationPreset.THREE_MONTHS,
                currency: 'INR',
                listAmount: 99900,
                taxIncluded: true,
                status: OfferStatus.ACTIVE,
                effectiveAmount: 99900,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          ],
        ]),
      );

      const result = await service.forExam(EXAM_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(PRODUCT_ID);
      expect(productsService.findPublishedByGrantMatchers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            scopeType: EntitlementScopeType.EXAM_GROUP,
          }),
          expect.objectContaining({
            scopeType: EntitlementScopeType.EXAM,
          }),
        ]),
      );
      // Exam endpoint must not match MOCK_TEST-only
      const matchers =
        productsService.findPublishedByGrantMatchers.mock.calls[0][0];
      expect(
        matchers.some(
          (m: { scopeType: string }) =>
            m.scopeType === EntitlementScopeType.MOCK_TEST,
        ),
      ).toBe(false);
    });
  });

  describe('forMockTest', () => {
    it('includes MOCK_TEST product plus exam/group covers', async () => {
      mockTestModel.findById.mockReturnValue({
        select: () => ({
          lean: () =>
            Promise.resolve({
              _id: MOCK_ID,
              exam: new Types.ObjectId(EXAM_ID),
            }),
        }),
      });
      examModel.findById.mockReturnValue({
        select: () => ({
          lean: () =>
            Promise.resolve({
              _id: EXAM_ID,
              examGroup: new Types.ObjectId(GROUP_ID),
            }),
        }),
      });

      const mockProduct = publishedProductDoc(MOCK_PRODUCT_ID, [
        {
          scopeType: EntitlementScopeType.MOCK_TEST,
          scopeId: new Types.ObjectId(MOCK_ID),
        },
      ]);
      productsService.findPublishedByGrantMatchers.mockResolvedValue([
        mockProduct,
      ]);
      offersService.listActiveByProductIds.mockResolvedValue(new Map());

      const result = await service.forMockTest(MOCK_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(MOCK_PRODUCT_ID);

      const matchers =
        productsService.findPublishedByGrantMatchers.mock.calls[0][0];
      expect(
        matchers.some(
          (m: { scopeType: string }) =>
            m.scopeType === EntitlementScopeType.MOCK_TEST,
        ),
      ).toBe(true);
    });
  });

  describe('getProduct', () => {
    it('hides archived by returning not found when findPublished misses', async () => {
      productsService.findPublished.mockResolvedValue(null);
      await expect(service.getProduct(PRODUCT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns ACTIVE offers only (via offersService)', async () => {
      const product = publishedProductDoc(PRODUCT_ID, [
        {
          scopeType: EntitlementScopeType.EXAM_GROUP,
          scopeId: new Types.ObjectId(GROUP_ID),
        },
      ]);
      productsService.findPublished.mockResolvedValue(product);
      offersService.listActiveByProduct.mockResolvedValue([
        {
          id: 'o1',
          productId: PRODUCT_ID,
          durationPreset: DurationPreset.ONE_MONTH,
          currency: 'INR',
          listAmount: 49900,
          taxIncluded: true,
          status: OfferStatus.ACTIVE,
          effectiveAmount: 49900,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getProduct(PRODUCT_ID);
      expect(result.offers).toHaveLength(1);
      expect(result.offers[0].status).toBe(OfferStatus.ACTIVE);
      expect(offersService.listActiveByProduct).toHaveBeenCalledWith(
        PRODUCT_ID,
        expect.any(Date),
      );
    });
  });

  describe('listProducts', () => {
    it('only lists published products from productsService.listPublished', async () => {
      productsService.listPublished.mockResolvedValue({
        data: [
          publishedProductDoc(PRODUCT_ID, [
            {
              scopeType: EntitlementScopeType.EXAM_GROUP,
              scopeId: new Types.ObjectId(GROUP_ID),
            },
          ]),
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
      offersService.listActiveByProductIds.mockResolvedValue(new Map());

      const result = await service.listProducts({});
      expect(result.data).toHaveLength(1);
      expect(productsService.listPublished).toHaveBeenCalled();
    });
  });
});
