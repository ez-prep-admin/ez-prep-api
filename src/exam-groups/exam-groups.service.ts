import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { ExamGroup, ExamGroupDocument } from './schemas/exam-group.schema';
import { CreateExamGroupDto } from './dto/create-exam-group.dto';
import { UpdateExamGroupDto } from './dto/update-exam-group.dto';
import { ExamGroupResponseDto } from './dto/exam-group-response.dto';
import { PaginatedExamGroupsResponseDto } from './dto/paginated-exam-groups-response.dto';

@Injectable()
export class ExamGroupsService {
  constructor(
    @InjectModel(ExamGroup.name)
    private examGroupModel: Model<ExamGroupDocument>,
  ) {}

  /**
   * Create a new exam group
   */
  async create(
    createExamGroupDto: CreateExamGroupDto,
  ): Promise<ExamGroupResponseDto> {
    // Check for duplicate name
    const existing = await this.examGroupModel
      .findOne({
        name: createExamGroupDto.name,
        category: new Types.ObjectId(createExamGroupDto.category),
      })
      .exec();

    if (existing) {
      throw new ConflictException(
        'Exam group with this name already exists in the category',
      );
    }

    const examGroup = await this.examGroupModel.create(createExamGroupDto);
    return this.toResponseDto(examGroup);
  }

  /**
   * Find all exam groups with pagination and search
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoryId?: string,
    activeOnly: boolean = false,
  ): Promise<PaginatedExamGroupsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<ExamGroup> = {};

    if (activeOnly) {
      query.isActive = true;
    }

    if (categoryId) {
      query.category = new Types.ObjectId(categoryId);
    }

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    const [examGroups, total] = await Promise.all([
      this.examGroupModel
        .find(query)
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.examGroupModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: examGroups.map(group => this.toResponseDto(group)),
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
   * Find one exam group by ID
   */
  async findOne(id: string): Promise<ExamGroupResponseDto> {
    const examGroup = await this.examGroupModel
      .findById(id)
      .populate('category')
      .exec();

    if (!examGroup) {
      throw new NotFoundException(`Exam group with ID "${id}" not found`);
    }

    return this.toResponseDto(examGroup);
  }

  /**
   * Find exam groups by category ID
   */
  async findByCategory(categoryId: string): Promise<ExamGroupResponseDto[]> {
    const examGroups = await this.examGroupModel
      .find({ category: new Types.ObjectId(categoryId), isActive: true })
      .sort({ name: 1 })
      .exec();

    return examGroups.map(group => this.toResponseDto(group));
  }

  /**
   * Update exam group
   */
  async update(
    id: string,
    updateExamGroupDto: UpdateExamGroupDto,
  ): Promise<ExamGroupResponseDto> {
    // Check for duplicate if name is being updated
    if (updateExamGroupDto.name) {
      const existing = await this.examGroupModel
        .findOne({
          _id: { $ne: id },
          name: updateExamGroupDto.name,
        })
        .exec();

      if (existing) {
        throw new ConflictException('Exam group with this name already exists');
      }
    }

    const examGroup = await this.examGroupModel
      .findByIdAndUpdate(id, updateExamGroupDto, { new: true })
      .populate('category')
      .exec();

    if (!examGroup) {
      throw new NotFoundException(`Exam group with ID "${id}" not found`);
    }

    return this.toResponseDto(examGroup);
  }

  /**
   * Soft delete exam group
   */
  async remove(id: string): Promise<ExamGroupResponseDto> {
    const examGroup = await this.examGroupModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .populate('category')
      .exec();

    if (!examGroup) {
      throw new NotFoundException(`Exam group with ID "${id}" not found`);
    }

    return this.toResponseDto(examGroup);
  }

  /**
   * Get active exam groups only (for public API)
   */
  async findActiveExamGroups(): Promise<ExamGroupResponseDto[]> {
    const examGroups = await this.examGroupModel
      .find({ isActive: true })
      .populate('category')
      .sort({ name: 1 })
      .exec();

    return examGroups.map(group => this.toResponseDto(group));
  }

  /**
   * Helper to convert document to DTO
   */
  private toResponseDto(examGroup: ExamGroupDocument): ExamGroupResponseDto {
    return new ExamGroupResponseDto(examGroup.toObject());
  }
}
