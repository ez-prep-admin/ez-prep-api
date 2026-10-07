import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { ProductsService } from '../products/products.service';
import { OffersService } from './offers.service';
import { Offer } from './schemas/offer.schema';

const PRODUCT_ID = '507f1f77bcf86cd799439031';
const OFFER_ID = '507f1f77bcf86cd799439032';

function offerDoc(overrides: Record<string, unknown> = {}) {
  const doc: any = {
    _id: new Types.ObjectId(OFFER_ID),
    productId: new Types.ObjectId(PRODUCT_ID),
    durationPreset: DurationPreset.THREE_MONTHS,
    currency: 'INR',
    listAmount: 99900,
    saleAmount: 79900,
    taxIncluded: true,
    saleValidFrom: new Date('2026-06-01T00:00:00.000Z'),
    saleValidUntil: new Date('2026-06-30T23:59:59.999Z'),
    status: OfferStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
  doc.save = jest.fn().mockResolvedValue(doc);
  doc.toObject = () => ({
    id: String(doc._id),
    productId: doc.productId,
    durationPreset: doc.durationPreset,
    currency: doc.currency,
    listAmount: doc.listAmount,
    saleAmount: doc.saleAmount,
    taxIncluded: doc.taxIncluded,
    saleValidFrom: doc.saleValidFrom,
    saleValidUntil: doc.saleValidUntil,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
  return doc;
}

describe('OffersService', () => {
  let service: OffersService;

  const offerModel: any = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  };

  const productsService = {
    findDocumentById: jest.fn().mockResolvedValue({ _id: PRODUCT_ID }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: getModelToken(Offer.name), useValue: offerModel },
        { provide: ProductsService, useValue: productsService },
      ],
    }).compile();

    service = module.get(OffersService);
    jest.clearAllMocks();
    productsService.findDocumentById.mockResolvedValue({ _id: PRODUCT_ID });
  });

  describe('unique ACTIVE conflict', () => {
    it('rejects a second ACTIVE offer for same product+duration', async () => {
      offerModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(offerDoc()),
      });

      await expect(
        service.create(PRODUCT_ID, {
          durationPreset: DurationPreset.THREE_MONTHS,
          listAmount: 89900,
          status: OfferStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(offerModel.create).not.toHaveBeenCalled();
    });

    it('maps Mongo duplicate key to ConflictException', async () => {
      offerModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(null),
      });
      const err = Object.assign(new Error('dup'), { code: 11000 });
      offerModel.create.mockRejectedValue(err);

      await expect(
        service.create(PRODUCT_ID, {
          durationPreset: DurationPreset.THREE_MONTHS,
          listAmount: 99900,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('create happy path', () => {
    it('creates an ACTIVE offer in paise', async () => {
      offerModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(null),
      });
      offerModel.create.mockResolvedValue(offerDoc());

      const result = await service.create(PRODUCT_ID, {
        durationPreset: DurationPreset.THREE_MONTHS,
        listAmount: 99900,
        saleAmount: 79900,
        saleValidFrom: '2026-06-01T00:00:00.000Z',
        saleValidUntil: '2026-06-30T23:59:59.999Z',
      });

      expect(result.listAmount).toBe(99900);
      expect(result.currency).toBe('INR');
      expect(result.taxIncluded).toBe(true);
    });
  });

  describe('listActiveByProduct', () => {
    it('attaches effectiveAmount and excludes callers of inactive via query', async () => {
      const active = offerDoc();
      offerModel.find.mockReturnValue({
        sort: () => ({
          exec: () => Promise.resolve([active]),
        }),
      });

      const duringSale = await service.listActiveByProduct(
        PRODUCT_ID,
        new Date('2026-06-15T12:00:00.000Z'),
      );
      expect(duringSale).toHaveLength(1);
      expect(duringSale[0].effectiveAmount).toBe(79900);
      expect(offerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: OfferStatus.ACTIVE }),
      );
    });
  });

  describe('update status to INACTIVE', () => {
    it('allows deactivating an offer', async () => {
      const doc = offerDoc();
      offerModel.findById.mockReturnValue({
        exec: () => Promise.resolve(doc),
      });

      const result = await service.update(OFFER_ID, {
        status: OfferStatus.INACTIVE,
      });
      expect(result.status).toBe(OfferStatus.INACTIVE);
    });
  });
});
