import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { PaginatedCategoriesResponseDto } from './dto/paginated-categories-response.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
  ) {}

  /**
   * Create a new category
   */
  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Check for duplicate name or shortName
    const existing = await this.categoryModel
      .findOne({
        $or: [
          { name: createCategoryDto.name },
          { shortName: createCategoryDto.shortName },
        ],
      })
      .exec();

    if (existing) {
      throw new ConflictException(
        'Category with this name or short name already exists',
      );
    }

    const category = await this.categoryModel.create(createCategoryDto);
    return this.toResponseDto(category);
  }

  /**
   * Find all categories with pagination and search
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    activeOnly: boolean = false,
  ): Promise<PaginatedCategoriesResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<Category> = {};

    if (activeOnly) {
      query.isActive = true;
    }

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    const [categories, total] = await Promise.all([
      this.categoryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.categoryModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: categories.map(cat => this.toResponseDto(cat)),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  }

  /**
   * Find one category by ID
   */
  async findOne(id: string): Promise<CategoryResponseDto> {
    const category = await this.categoryModel.findById(id).exec();

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return this.toResponseDto(category);
  }

  /**
   * Find category by short name
   */
  async findByShortName(shortName: string): Promise<CategoryResponseDto> {
    const category = await this.categoryModel
      .findOne({ shortName: shortName.toUpperCase() })
      .exec();

    if (!category) {
      throw new NotFoundException(
        `Category with short name "${shortName}" not found`,
      );
    }

    return this.toResponseDto(category);
  }

  /**
   * Update category
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Check for duplicate if name/shortName is being updated
    if (updateCategoryDto.name || updateCategoryDto.shortName) {
      const existing = await this.categoryModel
        .findOne({
          _id: { $ne: id },
          $or: [
            ...(updateCategoryDto.name
              ? [{ name: updateCategoryDto.name }]
              : []),
            ...(updateCategoryDto.shortName
              ? [{ shortName: updateCategoryDto.shortName }]
              : []),
          ],
        })
        .exec();

      if (existing) {
        throw new ConflictException(
          'Category with this name or short name already exists',
        );
      }
    }

    const category = await this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { new: true })
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return this.toResponseDto(category);
  }

  /**
   * Soft delete category
   */
  async remove(id: string): Promise<CategoryResponseDto> {
    const category = await this.categoryModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return this.toResponseDto(category);
  }

  /**
   * Get active categories only (for public API)
   */
  async findActiveCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();

    return categories.map(cat => this.toResponseDto(cat));
  }

  /**
   * Helper to convert document to DTO
   */
  private toResponseDto(category: CategoryDocument): CategoryResponseDto {
    return new CategoryResponseDto(category.toObject());
  }
}
