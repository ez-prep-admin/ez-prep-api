import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { assertPaise } from '../common/commerce/assert-paise';
import { resolveEffectiveAmount } from '../common/commerce/resolve-effective-amount';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { ProductsService } from '../products/products.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferResponseDto } from './dto/offer-response.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { Offer, OfferDocument } from './schemas/offer.schema';

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    private readonly productsService: ProductsService,
    private readonly commerceAuditService: CommerceAuditService,
  ) {}

  async create(
    productId: string,
    dto: CreateOfferDto,
    actorUserId?: string,
  ): Promise<OfferResponseDto> {
    await this.productsService.findDocumentById(productId);

    try {
      assertPaise(dto.listAmount, 'listAmount');
      if (dto.saleAmount != null) {
        assertPaise(dto.saleAmount, 'saleAmount');
      }
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid amount',
      );
    }

    const status = dto.status ?? OfferStatus.ACTIVE;

    if (status === OfferStatus.ACTIVE) {
      await this.assertNoActiveConflict(productId, dto.durationPreset);
    }

    try {
      const offer = await this.offerModel.create({
        productId: new Types.ObjectId(productId),
        durationPreset: dto.durationPreset,
        currency: 'INR',
        listAmount: dto.listAmount,
        saleAmount: dto.saleAmount,
        taxIncluded: true,
        saleValidFrom: dto.saleValidFrom
          ? new Date(dto.saleValidFrom)
          : undefined,
        saleValidUntil: dto.saleValidUntil
          ? new Date(dto.saleValidUntil)
          : undefined,
        status,
      });
      const response = this.toResponse(offer);
      await this.commerceAuditService.log({
        actorUserId,
        action: 'OFFER_CREATED',
        resourceType: 'offer',
        resourceId: response.id,
        after: {
          productId: response.productId,
          durationPreset: response.durationPreset,
          listAmount: response.listAmount,
          saleAmount: response.saleAmount,
          status: response.status,
        },
      });
      return response;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `An ACTIVE offer already exists for this product and duration (${dto.durationPreset})`,
        );
      }
      throw error;
    }
  }

  async findOne(id: string): Promise<OfferResponseDto> {
    const offer = await this.findOfferOrThrow(id);
    return this.toResponse(offer);
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    actorUserId?: string,
  ): Promise<OfferResponseDto> {
    const offer = await this.findOfferOrThrow(id);
    const before = {
      durationPreset: offer.durationPreset,
      listAmount: offer.listAmount,
      saleAmount: offer.saleAmount,
      status: offer.status,
    };

    if (dto.listAmount !== undefined) {
      try {
        assertPaise(dto.listAmount, 'listAmount');
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Invalid listAmount',
        );
      }
      offer.listAmount = dto.listAmount;
    }

    if (dto.saleAmount !== undefined) {
      if (dto.saleAmount === null) {
        offer.saleAmount = undefined;
      } else {
        try {
          assertPaise(dto.saleAmount, 'saleAmount');
        } catch (e) {
          throw new BadRequestException(
            e instanceof Error ? e.message : 'Invalid saleAmount',
          );
        }
        offer.saleAmount = dto.saleAmount;
      }
    }

    if (dto.saleValidFrom !== undefined) {
      offer.saleValidFrom =
        dto.saleValidFrom === null ? undefined : new Date(dto.saleValidFrom);
    }
    if (dto.saleValidUntil !== undefined) {
      offer.saleValidUntil =
        dto.saleValidUntil === null ? undefined : new Date(dto.saleValidUntil);
    }

    if (dto.status !== undefined && dto.status !== offer.status) {
      if (dto.status === OfferStatus.ACTIVE) {
        await this.assertNoActiveConflict(
          String(offer.productId),
          offer.durationPreset,
          String(offer._id),
        );
      }
      offer.status = dto.status;
    }

    try {
      await offer.save();
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `An ACTIVE offer already exists for this product and duration (${offer.durationPreset})`,
        );
      }
      throw error;
    }

    const response = this.toResponse(offer);
    await this.commerceAuditService.log({
      actorUserId,
      action: 'OFFER_UPDATED',
      resourceType: 'offer',
      resourceId: response.id,
      before,
      after: {
        durationPreset: response.durationPreset,
        listAmount: response.listAmount,
        saleAmount: response.saleAmount,
        status: response.status,
      },
    });
    return response;
  }

  async listByProduct(
    productId: string,
    options?: { activeOnly?: boolean },
  ): Promise<OfferResponseDto[]> {
    const query: Record<string, unknown> = {
      productId: new Types.ObjectId(productId),
    };
    if (options?.activeOnly) {
      query.status = OfferStatus.ACTIVE;
    }
    const rows = await this.offerModel
      .find(query)
      .sort({ durationPreset: 1 })
      .exec();
    return rows.map(o => this.toResponse(o));
  }

  async listActiveByProduct(
    productId: string,
    now: Date = new Date(),
  ): Promise<OfferResponseDto[]> {
    const rows = await this.offerModel
      .find({
        productId: new Types.ObjectId(productId),
        status: OfferStatus.ACTIVE,
      })
      .sort({ durationPreset: 1 })
      .exec();
    return rows.map(o => this.toResponse(o, now));
  }

  async listActiveByProductIds(
    productIds: string[],
    now: Date = new Date(),
  ): Promise<Map<string, OfferResponseDto[]>> {
    const map = new Map<string, OfferResponseDto[]>();
    if (!productIds.length) {
      return map;
    }
    const rows = await this.offerModel
      .find({
        productId: { $in: productIds.map(id => new Types.ObjectId(id)) },
        status: OfferStatus.ACTIVE,
      })
      .sort({ durationPreset: 1 })
      .exec();

    for (const row of rows) {
      const key = String(row.productId);
      const list = map.get(key) ?? [];
      list.push(this.toResponse(row, now));
      map.set(key, list);
    }
    return map;
  }

  private async assertNoActiveConflict(
    productId: string,
    durationPreset: string,
    excludeOfferId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = {
      productId: new Types.ObjectId(productId),
      durationPreset,
      status: OfferStatus.ACTIVE,
    };
    if (excludeOfferId) {
      query._id = { $ne: new Types.ObjectId(excludeOfferId) };
    }
    const existing = await this.offerModel.findOne(query).exec();
    if (existing) {
      throw new ConflictException(
        `An ACTIVE offer already exists for this product and duration (${durationPreset})`,
      );
    }
  }

  private async findOfferOrThrow(id: string): Promise<OfferDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Offer with ID "${id}" not found`);
    }
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) {
      throw new NotFoundException(`Offer with ID "${id}" not found`);
    }
    return offer;
  }

  private toResponse(offer: OfferDocument, now?: Date): OfferResponseDto {
    const obj = offer.toObject();
    const base: OfferResponseDto = {
      id: String(obj.id ?? offer._id),
      productId: String(obj.productId),
      durationPreset: obj.durationPreset,
      currency: obj.currency,
      listAmount: obj.listAmount,
      saleAmount: obj.saleAmount,
      taxIncluded: obj.taxIncluded,
      saleValidFrom: obj.saleValidFrom,
      saleValidUntil: obj.saleValidUntil,
      status: obj.status,
      createdAt: obj.createdAt as Date,
      updatedAt: obj.updatedAt as Date,
    };
    if (now) {
      base.effectiveAmount = resolveEffectiveAmount(offer, now);
    }
    return base;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }
}
