import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { ImageUrlResolver } from '../aws/s3/image-url.resolver';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { ImageMetadataDto } from '../questions/dto/image-metadata.dto';
import { CreateCurrentAffairDto } from './dto/create-current-affair.dto';
import { CurrentAffairResponseDto } from './dto/current-affair-response.dto';
import { PaginatedCurrentAffairsResponseDto } from './dto/paginated-current-affairs-response.dto';
import { UpdateCurrentAffairDto } from './dto/update-current-affair.dto';
import {
  CurrentAffair,
  CurrentAffairDocument,
  CurrentAffairImage,
} from './schemas/current-affair.schema';
import { isCalendarDate } from './utils/calendar-date';

@Injectable()
export class CurrentAffairsService {
  constructor(
    @InjectModel(CurrentAffair.name)
    private readonly currentAffairModel: Model<CurrentAffairDocument>,
    private readonly imageUrlResolver: ImageUrlResolver,
  ) {}

  async create(
    dto: CreateCurrentAffairDto,
  ): Promise<CurrentAffairResponseDto> {
    const sortOrder = await this.nextSortOrder(dto.date);
    const storedImage = this.toStoredImage(dto.image);
    const item = await this.currentAffairModel.create({
      title: dto.title,
      description: dto.description,
      memoryTrick: dto.memoryTrick,
      dateKey: dto.date,
      ...(storedImage ? { image: storedImage } : {}),
      sortOrder,
    });

    return this.toResponseDto(item);
  }

  async findAll(
    page = 1,
    limit = 10,
    date?: string,
    search?: string,
    activeOnly = false,
  ): Promise<PaginatedCurrentAffairsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<CurrentAffair> = {
      isDeleted: { $ne: true },
    };

    if (date) {
      if (!isCalendarDate(date)) {
        throw new BadRequestException(
          'date must be a valid calendar date in YYYY-MM-DD format',
        );
      }
      query.dateKey = date;
    }

    if (activeOnly) {
      query.isActive = true;
    }

    if (search?.trim()) {
      query.$text = { $search: search.trim() };
    }

    const sort = date
      ? { sortOrder: 1 as const, createdAt: 1 as const }
      : {
          dateKey: -1 as const,
          sortOrder: 1 as const,
          createdAt: 1 as const,
        };

    const [items, total] = await Promise.all([
      this.currentAffairModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.currentAffairModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);
    const pagination: PaginationMetaDto = {
      total,
      page: validPage,
      limit: validLimit,
      totalPages,
      hasNextPage: validPage < totalPages,
      hasPrevPage: validPage > 1,
    };

    return {
      data: await this.toResponseDtos(items),
      pagination,
    };
  }

  async findOne(id: string): Promise<CurrentAffairResponseDto> {
    const item = await this.currentAffairModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`Current affair with ID "${id}" not found`);
    }
    return this.toResponseDto(item);
  }

  async update(
    id: string,
    dto: UpdateCurrentAffairDto,
  ): Promise<CurrentAffairResponseDto> {
    const existing = await this.currentAffairModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Current affair with ID "${id}" not found`);
    }

    const $set: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      $set.title = dto.title;
    }
    if (dto.description !== undefined) {
      $set.description = dto.description;
    }
    if (dto.memoryTrick !== undefined) {
      $set.memoryTrick = dto.memoryTrick;
    }
    if (dto.isActive !== undefined) {
      $set.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      $set.sortOrder = dto.sortOrder;
    }

    if (dto.date !== undefined) {
      if (!isCalendarDate(dto.date)) {
        throw new BadRequestException(
          'date must be a valid calendar date in YYYY-MM-DD format',
        );
      }
      if (dto.date !== existing.dateKey) {
        $set.dateKey = dto.date;
        if (dto.sortOrder === undefined) {
          $set.sortOrder = await this.nextSortOrder(dto.date);
        }
      }
    }

    if (dto.image) {
      const storedImage = this.toStoredImage(dto.image);
      if (storedImage) {
        $set.image = storedImage;
      }
    }

    const updateQuery: UpdateQuery<CurrentAffair> = {};
    if (Object.keys($set).length > 0) {
      updateQuery.$set = $set;
    }
    if (dto.image === null) {
      updateQuery.$unset = { image: 1 };
    }

    const item = await this.currentAffairModel
      .findByIdAndUpdate(id, updateQuery, { new: true })
      .exec();

    if (!item) {
      throw new NotFoundException(`Current affair with ID "${id}" not found`);
    }

    return this.toResponseDto(item);
  }

  async remove(id: string): Promise<CurrentAffairResponseDto> {
    const item = await this.currentAffairModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .exec();

    if (!item) {
      throw new NotFoundException(`Current affair with ID "${id}" not found`);
    }

    return this.toResponseDto(item);
  }

  private async nextSortOrder(dateKey: string): Promise<number> {
    const last = await this.currentAffairModel
      .findOne({ dateKey })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean()
      .exec();

    return (last?.sortOrder ?? -1) + 1;
  }

  private toStoredImage(
    image?: ImageMetadataDto | null,
  ): CurrentAffairImage | undefined {
    if (!image?.key || !image.bucket || !image.region) {
      return undefined;
    }

    const lastModified = image.lastModified
      ? new Date(image.lastModified)
      : undefined;

    return {
      key: image.key,
      bucket: image.bucket,
      region: image.region,
      contentType: image.contentType,
      size: image.size,
      lastModified:
        lastModified && !Number.isNaN(lastModified.getTime())
          ? lastModified
          : undefined,
    };
  }

  private async toResponseDtos(
    items: CurrentAffairDocument[],
  ): Promise<CurrentAffairResponseDto[]> {
    const urls = await this.imageUrlResolver.resolveMany(
      items.map(item => item.image),
    );

    return Promise.all(
      items.map((item, index) => this.toResponseDto(item, urls[index])),
    );
  }

  private async toResponseDto(
    item: CurrentAffairDocument,
    resolvedUrl?: string | null,
  ): Promise<CurrentAffairResponseDto> {
    const obj = item.toObject();
    const imageUrl =
      resolvedUrl !== undefined
        ? resolvedUrl
        : await this.imageUrlResolver.resolve(obj.image);

    return new CurrentAffairResponseDto({
      id: obj.id,
      title: obj.title,
      description: obj.description,
      memoryTrick: obj.memoryTrick,
      date: obj.dateKey,
      image: obj.image,
      imageUrl: imageUrl ?? undefined,
      sortOrder: obj.sortOrder,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    });
  }
}
