import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { OffersService } from '../offers/offers.service';
import { ProductsService } from '../products/products.service';
import { CoverageService } from '../entitlements/coverage.service';
import {
  CatalogProductDto,
  toCatalogProduct,
} from './dto/catalog-product-response.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly offersService: OffersService,
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
    private readonly coverageService: CoverageService,
  ) {}

  async listProducts(
    options: {
      page?: number;
      limit?: number;
      search?: string;
    },
    userId?: string,
  ): Promise<{
    data: CatalogProductDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const now = new Date();
    const { data, total, page, limit } =
      await this.productsService.listPublished(options);
    const ids = data.map(p => String(p._id));
    const offersByProduct = await this.offersService.listActiveByProductIds(
      ids,
      now,
    );

    const totalPages = Math.ceil(total / limit) || 1;
    const cards = data.map(product => this.toCard(product, offersByProduct));
    await this.attachOwnership(cards, userId);
    return {
      data: cards,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getProduct(id: string, userId?: string): Promise<CatalogProductDto> {
    const product = await this.productsService.findPublished(id);
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    const now = new Date();
    const offers = await this.offersService.listActiveByProduct(
      String(product._id),
      now,
    );
    const card = this.toCard(product, new Map([[String(product._id), offers]]));
    await this.attachOwnership([card], userId);
    return card;
  }

  async forExam(examId: string, userId?: string): Promise<CatalogProductDto[]> {
    if (!Types.ObjectId.isValid(examId)) {
      throw new NotFoundException(`Exam with ID "${examId}" not found`);
    }
    const exam = await this.examModel
      .findById(examId)
      .select('examGroup')
      .lean();
    if (!exam) {
      throw new NotFoundException(`Exam with ID "${examId}" not found`);
    }

    const matchers: Array<{ scopeType: string; scopeId: Types.ObjectId }> = [
      {
        scopeType: EntitlementScopeType.EXAM,
        scopeId: new Types.ObjectId(examId),
      },
    ];
    if (exam.examGroup) {
      matchers.push({
        scopeType: EntitlementScopeType.EXAM_GROUP,
        scopeId: new Types.ObjectId(String(exam.examGroup)),
      });
    }

    return this.coverWithOffers(matchers, userId);
  }

  async forMockTest(
    mockTestId: string,
    userId?: string,
  ): Promise<CatalogProductDto[]> {
    if (!Types.ObjectId.isValid(mockTestId)) {
      throw new NotFoundException(
        `Mock test with ID "${mockTestId}" not found`,
      );
    }
    const paper = await this.mockTestModel
      .findById(mockTestId)
      .select('exam')
      .lean();
    if (!paper) {
      throw new NotFoundException(
        `Mock test with ID "${mockTestId}" not found`,
      );
    }

    const matchers: Array<{ scopeType: string; scopeId: Types.ObjectId }> = [
      {
        scopeType: EntitlementScopeType.MOCK_TEST,
        scopeId: new Types.ObjectId(mockTestId),
      },
    ];

    if (paper.exam) {
      const examId = String(paper.exam);
      matchers.push({
        scopeType: EntitlementScopeType.EXAM,
        scopeId: new Types.ObjectId(examId),
      });
      const exam = await this.examModel
        .findById(examId)
        .select('examGroup')
        .lean();
      if (exam?.examGroup) {
        matchers.push({
          scopeType: EntitlementScopeType.EXAM_GROUP,
          scopeId: new Types.ObjectId(String(exam.examGroup)),
        });
      }
    }

    return this.coverWithOffers(matchers, userId);
  }

  private toCard(
    product: {
      _id: Types.ObjectId;
      publishedGrants?: Array<{ scopeType: string; scopeId: Types.ObjectId }>;
    },
    offersByProduct: Map<string, CatalogProductDto['offers']>,
  ): CatalogProductDto {
    const response = this.productsService.toProductResponse(product as never);
    const grants = (product.publishedGrants ?? []).map(grant => ({
      scopeType:
        grant.scopeType as CatalogProductDto['grants'][number]['scopeType'],
      scopeId: String(grant.scopeId),
    }));
    return toCatalogProduct(
      { ...response, grants },
      offersByProduct.get(response.id) ?? [],
    );
  }

  private async attachOwnership(
    cards: CatalogProductDto[],
    userId?: string,
  ): Promise<void> {
    if (!userId || cards.length === 0) {
      return;
    }
    const ownership = await this.coverageService.ownershipByProduct(
      userId,
      cards.map(card => ({ id: card.id, grants: card.grants })),
    );
    for (const card of cards) {
      const row = ownership.get(card.id);
      if (!row) {
        continue;
      }
      card.coveredForLife = row.coveredForLife;
      if ('ownedUntil' in row) {
        card.ownedUntil = row.ownedUntil;
      }
    }
  }

  private async coverWithOffers(
    matchers: Array<{ scopeType: string; scopeId: Types.ObjectId }>,
    userId?: string,
  ): Promise<CatalogProductDto[]> {
    const now = new Date();
    const products =
      await this.productsService.findPublishedByGrantMatchers(matchers);
    const ids = products.map(p => String(p._id));
    const offersByProduct = await this.offersService.listActiveByProductIds(
      ids,
      now,
    );
    const cards = products.map(product =>
      this.toCard(product, offersByProduct),
    );
    await this.attachOwnership(cards, userId);
    return cards;
  }
}
