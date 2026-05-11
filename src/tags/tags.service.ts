import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tag, TagDocument } from './schemas/tag.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Topic, TopicDocument } from '../topics/schemas/topic.schema';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { PaginatedTagsResponseDto } from './dto/paginated-tags-response.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(Topic.name) private topicModel: Model<TopicDocument>,
  ) {}

  /**
   * Create a new tag
   * @param createTagDto - Tag creation data
   * @returns Created tag
   */
  async create(createTagDto: CreateTagDto): Promise<TagResponseDto> {
    // Validate subject exists
    const subject = await this.subjectModel.findById(createTagDto.subject);
    if (!subject) {
      throw new BadRequestException(
        `Subject with ID "${createTagDto.subject}" not found`,
      );
    }

    // Validate topic exists
    const topic = await this.topicModel.findById(createTagDto.topic);
    if (!topic) {
      throw new BadRequestException(
        `Topic with ID "${createTagDto.topic}" not found`,
      );
    }

    // Check for duplicate tag (same name, subject, and topic)
    const existingTag = await this.tagModel.findOne({
      name: createTagDto.name,
      subject: new Types.ObjectId(createTagDto.subject),
      topic: new Types.ObjectId(createTagDto.topic),
      isDeleted: false,
    });

    if (existingTag) {
      throw new ConflictException(
        `Tag "${createTagDto.name}" already exists for this subject and topic`,
      );
    }

    const tag = new this.tagModel({
      ...createTagDto,
      subject: new Types.ObjectId(createTagDto.subject),
      topic: new Types.ObjectId(createTagDto.topic),
    });

    await tag.save();
    return this.toResponseDto(tag);
  }

  /**
   * Find all tags with pagination and optional filtering
   * @param page - Page number
   * @param limit - Items per page
   * @param subjectId - Optional subject filter
   * @param topicId - Optional topic filter
   * @returns Paginated tags
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    subjectId?: string,
    topicId?: string,
  ): Promise<PaginatedTagsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: any = {};

    if (subjectId) {
      query.subject = new Types.ObjectId(subjectId);
    }

    if (topicId) {
      query.topic = new Types.ObjectId(topicId);
    }

    const [tags, total] = await Promise.all([
      this.tagModel
        .find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.tagModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: tags.map(tag => this.toResponseDto(tag)),
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
   * Find a single tag by ID
   * @param id - Tag ID
   * @returns Tag details
   * @throws NotFoundException if tag not found
   */
  async findOne(id: string): Promise<TagResponseDto> {
    const tag = await this.tagModel.findById(id).exec();

    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }

    return this.toResponseDto(tag);
  }

  /**
   * Update a tag
   * @param id - Tag ID
   * @param updateTagDto - Update data
   * @returns Updated tag
   * @throws NotFoundException if tag not found
   */
  async update(
    id: string,
    updateTagDto: UpdateTagDto,
  ): Promise<TagResponseDto> {
    // If subject is being updated, validate it exists
    if (updateTagDto.subject) {
      const subject = await this.subjectModel.findById(updateTagDto.subject);
      if (!subject) {
        throw new BadRequestException(
          `Subject with ID "${updateTagDto.subject}" not found`,
        );
      }
    }

    // If topic is being updated, validate it exists
    if (updateTagDto.topic) {
      const topic = await this.topicModel.findById(updateTagDto.topic);
      if (!topic) {
        throw new BadRequestException(
          `Topic with ID "${updateTagDto.topic}" not found`,
        );
      }
    }

    // Check for duplicate if name, subject, or topic is being updated
    if (updateTagDto.name || updateTagDto.subject || updateTagDto.topic) {
      const tag = await this.tagModel.findById(id);
      if (!tag) {
        throw new NotFoundException(`Tag with ID "${id}" not found`);
      }

      const checkName = updateTagDto.name || tag.name;
      const checkSubject = updateTagDto.subject
        ? new Types.ObjectId(updateTagDto.subject)
        : tag.subject;
      const checkTopic = updateTagDto.topic
        ? new Types.ObjectId(updateTagDto.topic)
        : tag.topic;

      const existingTag = await this.tagModel.findOne({
        _id: { $ne: id },
        name: checkName,
        subject: checkSubject,
        topic: checkTopic,
        isDeleted: false,
      });

      if (existingTag) {
        throw new ConflictException(
          `Tag "${checkName}" already exists for this subject and topic`,
        );
      }
    }

    const updateData: any = { ...updateTagDto };
    if (updateTagDto.subject) {
      updateData.subject = new Types.ObjectId(updateTagDto.subject);
    }
    if (updateTagDto.topic) {
      updateData.topic = new Types.ObjectId(updateTagDto.topic);
    }

    const updatedTag = await this.tagModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updatedTag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }

    return this.toResponseDto(updatedTag);
  }

  /**
   * Soft delete a tag
   * @param id - Tag ID
   * @returns Success message
   * @throws NotFoundException if tag not found
   */
  async remove(id: string): Promise<{ message: string }> {
    const tag = await this.tagModel
      .findByIdAndUpdate(id, { isDeleted: true }, { new: true })
      .exec();

    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }

    return { message: 'Tag deleted successfully' };
  }

  /**
   * Helper method to convert Tag document to DTO
   * @param tag - Tag document
   * @returns TagResponseDto
   */
  private toResponseDto(tag: TagDocument): TagResponseDto {
    const obj = tag.toObject();
    return new TagResponseDto({
      id: tag._id?.toString(),
      name: obj.name,
      description: obj.description,
      subject: obj.subject?.toString(),
      topic: obj.topic?.toString(),
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    });
  }
}
