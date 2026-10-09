import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { CreateInstanceConfigDto } from './dto/create-instance-config.dto';
import {
  InstanceConfigResponseDto,
  InstanceSellerResponseDto,
  InstanceTaxConfigResponseDto,
} from './dto/instance-config-response.dto';
import { UpdateInstanceConfigDto } from './dto/update-instance-config.dto';
import {
  INSTANCE_CONFIG_ID,
  INSTANCE_CONFIG_SCHEMA_VERSION,
} from './instance-config.constants';
import {
  InstanceConfig,
  InstanceConfigDocument,
  InstanceSeller,
  InstanceTaxConfig,
} from './schemas/instance-config.schema';

@Injectable()
export class InstanceConfigService {
  constructor(
    @InjectModel(InstanceConfig.name)
    private readonly instanceConfigModel: Model<InstanceConfigDocument>,
  ) {}

  async get(): Promise<InstanceConfigResponseDto | null> {
    const config = await this.instanceConfigModel
      .findById(INSTANCE_CONFIG_ID)
      .exec();
    return config ? this.toResponse(config) : null;
  }

  async create(
    dto: CreateInstanceConfigDto,
  ): Promise<InstanceConfigResponseDto> {
    const existing = await this.instanceConfigModel
      .findById(INSTANCE_CONFIG_ID)
      .exec();
    if (existing) {
      throw new ConflictException('Instance configuration already exists');
    }

    try {
      const created = await this.instanceConfigModel.create({
        _id: INSTANCE_CONFIG_ID,
        schemaVersion: INSTANCE_CONFIG_SCHEMA_VERSION,
        name: dto.name,
        ...this.presentUrls(dto),
      });
      return this.toResponse(created);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('Instance configuration already exists');
      }
      throw error;
    }
  }

  async update(
    dto: UpdateInstanceConfigDto,
  ): Promise<InstanceConfigResponseDto> {
    const update = this.toUpdateQuery(dto);
    if (!update) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const updated = await this.instanceConfigModel
      .findByIdAndUpdate(INSTANCE_CONFIG_ID, update, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(
        'Instance configuration has not been created',
      );
    }

    return this.toResponse(updated);
  }

  private presentUrls(dto: {
    logoUrl?: string | null;
    faviconUrl?: string | null;
  }): { logoUrl?: string; faviconUrl?: string } {
    return {
      ...(dto.logoUrl ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.faviconUrl ? { faviconUrl: dto.faviconUrl } : {}),
    };
  }

  private toUpdateQuery(
    dto: UpdateInstanceConfigDto,
  ): UpdateQuery<InstanceConfigDocument> | null {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (dto.name !== undefined) {
      $set.name = dto.name;
    }

    this.assignOptionalUrl($set, $unset, 'logoUrl', dto.logoUrl);
    this.assignOptionalUrl($set, $unset, 'faviconUrl', dto.faviconUrl);
    this.assignNested($set, 'seller', dto.seller);
    this.assignNested($set, 'taxConfig', dto.taxConfig);

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return null;
    }

    return {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {}),
    };
  }

  private assignOptionalUrl(
    $set: Record<string, unknown>,
    $unset: Record<string, 1>,
    field: 'logoUrl' | 'faviconUrl',
    value: string | null | undefined,
  ): void {
    if (value === undefined) {
      return;
    }
    if (value === null) {
      $unset[field] = 1;
      return;
    }
    $set[field] = value;
  }

  private assignNested(
    $set: Record<string, unknown>,
    prefix: 'seller' | 'taxConfig',
    value: object | undefined,
  ): void {
    if (!value) {
      return;
    }
    for (const [key, field] of Object.entries(value)) {
      if (field !== undefined) {
        $set[`${prefix}.${key}`] = field;
      }
    }
  }

  private toResponse(
    config: InstanceConfigDocument,
  ): InstanceConfigResponseDto {
    return new InstanceConfigResponseDto({
      id: String(config._id),
      schemaVersion: config.schemaVersion ?? INSTANCE_CONFIG_SCHEMA_VERSION,
      name: config.name,
      logoUrl: config.logoUrl ?? null,
      faviconUrl: config.faviconUrl ?? null,
      seller: this.toSeller(config.seller),
      taxConfig: this.toTaxConfig(config.taxConfig),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  }

  private toSeller(
    seller?: InstanceSeller | null,
  ): InstanceSellerResponseDto | null {
    if (!seller) {
      return null;
    }
    return {
      legalName: seller.legalName ?? null,
      gstin: seller.gstin ?? null,
      registeredAddress: seller.registeredAddress ?? null,
      state: seller.state ?? null,
      stateCode: seller.stateCode ?? null,
      signatoryName: seller.signatoryName ?? null,
      signatoryDesignation: seller.signatoryDesignation ?? null,
    };
  }

  private toTaxConfig(
    tax?: InstanceTaxConfig | null,
  ): InstanceTaxConfigResponseDto | null {
    if (!tax) {
      return null;
    }
    return {
      taxEnabled: tax.taxEnabled ?? null,
      taxType: tax.taxType ?? null,
      taxRate: tax.taxRate ?? null,
      pricesAreTaxInclusive: tax.pricesAreTaxInclusive ?? null,
      currency: tax.currency ?? null,
      sacCode: tax.sacCode ?? null,
      sacDescription: tax.sacDescription ?? null,
      invoiceSeriesPrefix: tax.invoiceSeriesPrefix ?? null,
    };
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
