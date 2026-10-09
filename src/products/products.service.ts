import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  buildProductVersionSnapshot,
  grantsEqual,
  ProductGrantSnapshot,
} from '../common/commerce/product-version-snapshot';
import { ProductStatus } from '../common/enums/product-status.enum';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { DuplicateProductDto } from './dto/duplicate-product.dto';
import { ProductGrantDto } from './dto/product-grant.dto';
import {
  ProductResponseDto,
  ProductVersionResponseDto,
} from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GrantValidationService } from './grant-validation.service';
import { Product, ProductDocument } from './schemas/product.schema';
import {
  ProductVersion,
  ProductVersionDocument,
} from './schemas/product-version.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVersion.name)
    private readonly productVersionModel: Model<ProductVersionDocument>,
    private readonly grantValidation: GrantValidationService,
    private readonly commerceAuditService: CommerceAuditService,
  ) {}

  async create(
    dto: CreateProductDto,
    actorUserId?: string,
  ): Promise<ProductResponseDto> {
    const code = dto.code.toUpperCase();
    const existing = await this.productModel.findOne({ code }).exec();
    if (existing) {
      throw new ConflictException(`Product code "${code}" already exists`);
    }

    const product = await this.productModel.create({
      code,
      name: dto.name,
      description: dto.description,
      status: ProductStatus.DRAFT,
      version: 0,
      grants: this.toGrantDocs(dto.grants ?? []),
      display: dto.display,
      metadata: dto.metadata,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
      updatedBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
    });

    return this.toProductResponse(product);
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: ProductStatus;
    search?: string;
  }): Promise<{
    data: ProductResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const query: FilterQuery<Product> = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.search?.trim()) {
      const term = options.search.trim();
      query.$or = [
        { code: new RegExp(term, 'i') },
        { name: new RegExp(term, 'i') },
      ];
    }

    const [rows, total] = await Promise.all([
      this.productModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      data: rows.map(p => this.toProductResponse(p)),
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

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.findProductOrThrow(id);
    return this.toProductResponse(product);
  }

  /** Internal: load raw document (for offers/catalog). */
  async findDocumentById(id: string): Promise<ProductDocument> {
    return this.findProductOrThrow(id);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorUserId?: string,
  ): Promise<ProductResponseDto> {
    const product = await this.findProductOrThrow(id);

    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Archived products cannot be edited');
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.grants !== undefined) product.grants = this.toGrantDocs(dto.grants);
    if (dto.display !== undefined) product.display = dto.display;
    if (dto.metadata !== undefined) product.metadata = dto.metadata;
    if (actorUserId) {
      product.updatedBy = new Types.ObjectId(actorUserId);
    }

    await product.save();
    return this.toProductResponse(product);
  }

  /**
   * Publish DRAFT → PUBLISHED, or republish PUBLISHED with material changes.
   * Material change (grants / name / code / description vs last frozen version)
   * bumps version and inserts an immutable product_versions row.
   */
  async publish(id: string, actorUserId?: string): Promise<ProductResponseDto> {
    const product = await this.findProductOrThrow(id);

    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Archived products cannot be published');
    }

    const before = {
      status: product.status,
      version: product.version,
      code: product.code,
    };
    const grantsDto = product.grants.map(g => ({
      scopeType: g.scopeType,
      scopeId: String(g.scopeId),
    }));
    await this.grantValidation.assertGrantsValid(grantsDto);

    const lastVersion = await this.productVersionModel
      .findOne({ productId: product._id })
      .sort({ version: -1 })
      .lean()
      .exec();

    const currentGrants = this.toGrantSnapshots(product);
    const materialChange =
      !lastVersion ||
      lastVersion.name !== product.name ||
      lastVersion.code !== product.code ||
      (lastVersion.description ?? '') !== (product.description ?? '') ||
      !grantsEqual(
        currentGrants,
        (lastVersion.grants ?? []).map(g => ({
          scopeType: g.scopeType,
          scopeId: String(g.scopeId),
        })),
      );

    if (materialChange) {
      const nextVersion = (lastVersion?.version ?? 0) + 1;
      product.version = nextVersion;
      product.status = ProductStatus.PUBLISHED;
      if (actorUserId) {
        product.updatedBy = new Types.ObjectId(actorUserId);
      }
      await product.save();

      const snap = buildProductVersionSnapshot(
        {
          id: String(product._id),
          version: nextVersion,
          code: product.code,
          name: product.name,
          description: product.description,
          grants: currentGrants,
        },
        new Date(),
      );

      await this.productVersionModel.create({
        productId: product._id,
        version: snap.version,
        code: snap.code,
        name: snap.name,
        description: snap.description,
        grants: this.toGrantDocs(
          snap.grants.map(g => ({
            scopeType: g.scopeType,
            scopeId: g.scopeId,
          })),
        ),
        frozenAt: snap.frozenAt,
        publishedBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
      });
    } else {
      // Idempotent republish with no material change
      product.status = ProductStatus.PUBLISHED;
      if (actorUserId) {
        product.updatedBy = new Types.ObjectId(actorUserId);
      }
      await product.save();
    }

    const response = this.toProductResponse(product);
    await this.commerceAuditService.log({
      actorUserId,
      action: 'PRODUCT_PUBLISHED',
      resourceType: 'product',
      resourceId: response.id,
      before,
      after: {
        status: response.status,
        version: response.version,
        code: response.code,
      },
    });
    return response;
  }

  async archive(id: string, actorUserId?: string): Promise<ProductResponseDto> {
    const product = await this.findProductOrThrow(id);

    if (product.status === ProductStatus.DRAFT) {
      throw new BadRequestException(
        'Draft products cannot be archived; delete instead',
      );
    }
    if (product.status === ProductStatus.ARCHIVED) {
      return this.toProductResponse(product);
    }

    const before = {
      status: product.status,
      version: product.version,
      code: product.code,
    };
    product.status = ProductStatus.ARCHIVED;
    if (actorUserId) {
      product.updatedBy = new Types.ObjectId(actorUserId);
    }
    await product.save();
    const response = this.toProductResponse(product);
    await this.commerceAuditService.log({
      actorUserId,
      action: 'PRODUCT_ARCHIVED',
      resourceType: 'product',
      resourceId: response.id,
      before,
      after: {
        status: response.status,
        version: response.version,
        code: response.code,
      },
    });
    return response;
  }

  async softDelete(id: string, actorUserId?: string): Promise<void> {
    const product = await this.findProductOrThrow(id);
    product.isDeleted = true;
    if (actorUserId) {
      product.updatedBy = new Types.ObjectId(actorUserId);
    }
    await product.save();
  }

  async duplicate(
    id: string,
    dto: DuplicateProductDto,
    actorUserId?: string,
  ): Promise<ProductResponseDto> {
    const source = await this.findProductOrThrow(id);
    const code = (dto.code ?? `${source.code}_COPY`).toUpperCase();

    const existing = await this.productModel.findOne({ code }).exec();
    if (existing) {
      throw new ConflictException(`Product code "${code}" already exists`);
    }

    const product = await this.productModel.create({
      code,
      name: `${source.name} (Copy)`,
      description: source.description,
      status: ProductStatus.DRAFT,
      version: 0,
      grants: source.grants.map(g => ({
        scopeType: g.scopeType,
        scopeId: g.scopeId,
      })),
      display: source.display,
      metadata: source.metadata,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
      updatedBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
    });

    return this.toProductResponse(product);
  }

  async listVersions(productId: string): Promise<ProductVersionResponseDto[]> {
    await this.findProductOrThrow(productId);
    const rows = await this.productVersionModel
      .find({ productId: new Types.ObjectId(productId) })
      .sort({ version: 1 })
      .exec();
    return rows.map(v => this.toVersionResponse(v));
  }

  async getVersion(
    productId: string,
    version: number,
  ): Promise<ProductVersionResponseDto> {
    await this.findProductOrThrow(productId);
    const row = await this.productVersionModel
      .findOne({
        productId: new Types.ObjectId(productId),
        version,
      })
      .exec();
    if (!row) {
      throw new NotFoundException(
        `Product version ${version} not found for product "${productId}"`,
      );
    }
    return this.toVersionResponse(row);
  }

  /** Covering query helper for catalog — PUBLISHED products matching grant OR clauses. */
  async findPublishedByGrantMatchers(
    matchers: Array<{ scopeType: string; scopeId: Types.ObjectId }>,
  ): Promise<ProductDocument[]> {
    if (!matchers.length) {
      return [];
    }
    return this.productModel
      .find({
        status: ProductStatus.PUBLISHED,
        $or: matchers.map(m => ({
          grants: {
            $elemMatch: {
              scopeType: m.scopeType,
              scopeId: m.scopeId,
            },
          },
        })),
      })
      .sort({ code: 1 })
      .exec();
  }

  async findPublished(id: string): Promise<ProductDocument | null> {
    return this.productModel
      .findOne({ _id: id, status: ProductStatus.PUBLISHED })
      .exec();
  }

  async listPublished(options: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    data: ProductDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const query: FilterQuery<Product> = {
      status: ProductStatus.PUBLISHED,
    };
    if (options.search?.trim()) {
      const term = options.search.trim();
      query.$or = [
        { code: new RegExp(term, 'i') },
        { name: new RegExp(term, 'i') },
      ];
    }
    const [data, total] = await Promise.all([
      this.productModel
        .find(query)
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(query).exec(),
    ]);
    return { data, total, page, limit };
  }

  private async findProductOrThrow(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    return product;
  }

  private toGrantDocs(grants: ProductGrantDto[]) {
    return grants.map(g => ({
      scopeType: g.scopeType,
      scopeId: new Types.ObjectId(g.scopeId),
    }));
  }

  private toGrantSnapshots(product: ProductDocument): ProductGrantSnapshot[] {
    return product.grants.map(g => ({
      scopeType: g.scopeType,
      scopeId: String(g.scopeId),
    }));
  }

  toProductResponse(product: ProductDocument): ProductResponseDto {
    const obj = product.toObject();
    return {
      id: String(obj.id ?? product._id),
      code: obj.code,
      name: obj.name,
      description: obj.description,
      status: obj.status,
      version: obj.version,
      grants: (obj.grants ?? []).map(g => ({
        scopeType: g.scopeType,
        scopeId: String(g.scopeId),
      })),
      display: obj.display,
      metadata: obj.metadata,
      createdBy: obj.createdBy ? String(obj.createdBy) : undefined,
      updatedBy: obj.updatedBy ? String(obj.updatedBy) : undefined,
      createdAt: obj.createdAt as Date,
      updatedAt: obj.updatedAt as Date,
    };
  }

  private toVersionResponse(
    doc: ProductVersionDocument | Record<string, unknown>,
  ): ProductVersionResponseDto {
    const obj =
      typeof (doc as ProductVersionDocument).toObject === 'function'
        ? (doc as ProductVersionDocument).toObject()
        : doc;
    return {
      id: String(obj.id ?? (obj as { _id?: Types.ObjectId })._id),
      productId: String(obj.productId),
      version: obj.version as number,
      code: obj.code as string,
      name: obj.name as string,
      description: obj.description as string | undefined,
      grants: (
        (obj.grants as Array<{ scopeType: string; scopeId: unknown }>) ?? []
      ).map(g => ({
        scopeType: g.scopeType as ProductGrantSnapshot['scopeType'],
        scopeId: String(g.scopeId),
      })),
      frozenAt: obj.frozenAt as Date,
      publishedBy: obj.publishedBy ? String(obj.publishedBy) : undefined,
    };
  }
}
