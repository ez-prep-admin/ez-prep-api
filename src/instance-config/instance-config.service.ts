import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { CreateInstanceConfigDto } from './dto/create-instance-config.dto';
import { InstanceConfigResponseDto } from './dto/instance-config-response.dto';
import { UpdateInstanceConfigDto } from './dto/update-instance-config.dto';
import {
  INSTANCE_CONFIG_ID,
  INSTANCE_CONFIG_SCHEMA_VERSION,
} from './instance-config.constants';
import {
  InstanceConfig,
  InstanceConfigDocument,
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

  private toResponse(
    config: InstanceConfigDocument,
  ): InstanceConfigResponseDto {
    return new InstanceConfigResponseDto({
      id: String(config._id),
      schemaVersion: config.schemaVersion ?? INSTANCE_CONFIG_SCHEMA_VERSION,
      name: config.name,
      logoUrl: config.logoUrl ?? null,
      faviconUrl: config.faviconUrl ?? null,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
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
