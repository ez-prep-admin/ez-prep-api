import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Topic, TopicDocument } from './schemas/topic.schema';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicResponseDto } from './dto/topic-response.dto';

@Injectable()
export class TopicsService {
  constructor(
    @InjectModel(Topic.name)
    private topicModel: Model<TopicDocument>,
  ) {}

  /**
   * Create a new topic
   */
  async create(createTopicDto: CreateTopicDto): Promise<TopicResponseDto> {
    // Check for duplicate name
    const existing = await this.topicModel
      .findOne({ name: createTopicDto.name })
      .exec();

    if (existing) {
      throw new ConflictException('Topic with this name already exists');
    }

    const topic = await this.topicModel.create(createTopicDto);
    return this.toResponseDto(topic);
  }

  /**
   * Find all topics
   */
  async findAll(): Promise<TopicResponseDto[]> {
    const topics = await this.topicModel.find().sort({ name: 1 }).exec();
    return topics.map(topic => this.toResponseDto(topic));
  }

  /**
   * Find one topic by ID
   */
  async findOne(id: string): Promise<TopicResponseDto> {
    const topic = await this.topicModel.findById(id).exec();

    if (!topic) {
      throw new NotFoundException(`Topic with ID "${id}" not found`);
    }

    return this.toResponseDto(topic);
  }

  /**
   * Update topic
   */
  async update(
    id: string,
    updateTopicDto: UpdateTopicDto,
  ): Promise<TopicResponseDto> {
    // Check for duplicate name if name is being updated
    if (updateTopicDto.name) {
      const duplicate = await this.topicModel
        .findOne({
          _id: { $ne: id },
          name: updateTopicDto.name,
        })
        .exec();

      if (duplicate) {
        throw new ConflictException('Topic with this name already exists');
      }
    }

    const topic = await this.topicModel
      .findByIdAndUpdate(id, updateTopicDto, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!topic) {
      throw new NotFoundException(`Topic with ID "${id}" not found`);
    }

    return this.toResponseDto(topic);
  }

  /**
   * Soft delete topic
   */
  async remove(id: string): Promise<TopicResponseDto> {
    const topic = await this.topicModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .exec();

    if (!topic) {
      throw new NotFoundException(`Topic with ID "${id}" not found`);
    }

    return this.toResponseDto(topic);
  }

  /**
   * Helper to convert document to DTO
   */
  private toResponseDto(topic: TopicDocument): TopicResponseDto {
    const obj = topic.toObject();
    return new TopicResponseDto({
      ...obj,
      id: obj._id?.toString() || obj.id,
    });
  }
}
