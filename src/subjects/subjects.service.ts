import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject, SubjectDocument } from './schemas/subject.schema';
import { Topic, TopicDocument } from '../topics/schemas/topic.schema';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { SubjectForExamResponseDto } from './dto/subject-for-exam-response.dto';
import { PopulatedDocument } from '../common/types/populated-document.interface';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name)
    private subjectModel: Model<SubjectDocument>,
    @InjectModel(Topic.name)
    private topicModel: Model<TopicDocument>,
    @InjectModel(Exam.name)
    private examModel: Model<ExamDocument>,
  ) {}

  /**
   * Create a new subject
   */
  async create(
    createSubjectDto: CreateSubjectDto,
  ): Promise<SubjectResponseDto> {
    // Check for duplicate name
    const existing = await this.subjectModel
      .findOne({ name: createSubjectDto.name })
      .exec();

    if (existing) {
      throw new ConflictException('Subject with this name already exists');
    }

    // Validate topics if provided
    if (createSubjectDto.topics && createSubjectDto.topics.length > 0) {
      const topicsExist = await this.topicModel
        .find({ _id: { $in: createSubjectDto.topics } })
        .exec();

      if (topicsExist.length !== createSubjectDto.topics.length) {
        throw new BadRequestException('One or more topic IDs are invalid');
      }
    }

    const subject = await this.subjectModel.create(createSubjectDto);
    return this.toResponseDto(await subject.populate('topics', 'name'));
  }

  /**
   * Find all subjects
   */
  async findAll(): Promise<SubjectResponseDto[]> {
    const subjects = await this.subjectModel
      .find()
      .populate('topics', 'name')
      .sort({ name: 1 })
      .exec();
    return subjects.map(subject => this.toResponseDto(subject));
  }

  /**
   * Find one subject by ID
   */
  async findOne(id: string): Promise<SubjectResponseDto> {
    const subject = await this.subjectModel
      .findById(id)
      .populate('topics', 'name')
      .exec();

    if (!subject) {
      throw new NotFoundException(`Subject with ID "${id}" not found`);
    }

    return this.toResponseDto(subject);
  }

  /**
   * Update subject
   */
  async update(
    id: string,
    updateSubjectDto: UpdateSubjectDto,
  ): Promise<SubjectResponseDto> {
    // Check for duplicate name if name is being updated
    if (updateSubjectDto.name) {
      const duplicate = await this.subjectModel
        .findOne({
          _id: { $ne: id },
          name: updateSubjectDto.name,
        })
        .exec();

      if (duplicate) {
        throw new ConflictException('Subject with this name already exists');
      }
    }

    // Validate topics if provided
    if (updateSubjectDto.topics && updateSubjectDto.topics.length > 0) {
      const topicsExist = await this.topicModel
        .find({ _id: { $in: updateSubjectDto.topics } })
        .exec();

      if (topicsExist.length !== updateSubjectDto.topics.length) {
        throw new BadRequestException('One or more topic IDs are invalid');
      }
    }

    const subject = await this.subjectModel
      .findByIdAndUpdate(id, updateSubjectDto, {
        new: true,
        runValidators: true,
      })
      .populate('topics', 'name')
      .exec();

    if (!subject) {
      throw new NotFoundException(`Subject with ID "${id}" not found`);
    }

    return this.toResponseDto(subject);
  }

  /**
   * Soft delete subject
   */
  async remove(id: string): Promise<SubjectResponseDto> {
    const subject = await this.subjectModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .populate('topics', 'name')
      .exec();

    if (!subject) {
      throw new NotFoundException(`Subject with ID "${id}" not found`);
    }

    return this.toResponseDto(subject);
  }

  /**
   * Find all subjects belonging to a specific exam
   * Uses aggregation to join exam.subjects[] with the subjects collection in one DB round-trip
   * @param examId - Exam ID
   * @returns Array of subjects (id, name, description)
   */
  async findByExam(examId: string): Promise<SubjectForExamResponseDto[]> {
    const results = await this.examModel
      .aggregate<{ _id: Types.ObjectId; name: string; description?: string }>([
        {
          $match: {
            _id: new Types.ObjectId(examId),
            isDeleted: { $ne: true },
          },
        },
        { $unwind: '$subjects' },
        {
          $lookup: {
            from: 'subjects',
            localField: 'subjects.subject',
            foreignField: '_id',
            as: 'subjectDoc',
          },
        },
        { $unwind: '$subjectDoc' },
        {
          $match: {
            'subjectDoc.isDeleted': { $ne: true },
            'subjectDoc.isActive': true,
          },
        },
        {
          $group: {
            _id: '$subjectDoc._id',
            name: { $first: '$subjectDoc.name' },
            description: { $first: '$subjectDoc.description' },
          },
        },
        { $sort: { name: 1 } },
      ])
      .exec();

    if (!results.length) {
      // Verify the exam exists so we can return a meaningful error
      const examExists = await this.examModel
        .exists({ _id: new Types.ObjectId(examId), isDeleted: { $ne: true } })
        .exec();

      if (!examExists) {
        throw new NotFoundException(`Exam with ID "${examId}" not found`);
      }
    }

    return results.map(
      doc =>
        new SubjectForExamResponseDto({
          id: doc._id.toString(),
          name: doc.name,
          description: doc.description,
        }),
    );
  }

  /**
   * Helper to convert document to DTO
   */
  private toResponseDto(subject: SubjectDocument): SubjectResponseDto {
    const obj = subject.toObject();
    return new SubjectResponseDto({
      ...obj,
      id: obj._id?.toString() || obj.id,
      topics:
        obj.topics?.map((topic: unknown) => {
          const topicDoc = topic as PopulatedDocument;
          return {
            id:
              topicDoc._id?.toString() ||
              (typeof topic === 'string' ? topic : ''),
            name: topicDoc.name || '',
          };
        }) || [],
    });
  }
}
