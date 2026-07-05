import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  Question,
  QuestionDocument,
} from '../schemas/question.schema';
import { Subject, SubjectDocument } from '../../subjects/schemas/subject.schema';
import { Topic, TopicDocument } from '../../topics/schemas/topic.schema';
import { Exam, ExamDocument } from '../../exams/schemas/exam.schema';
import { Tag, TagDocument } from '../../tags/schemas/tag.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  PopulatedRefDto,
  QuestionResponseDto,
} from './dto/question-response.dto';
import { PaginatedQuestionsResponseDto } from './dto/paginated-questions-response.dto';

type PopulatedQuestion = QuestionDocument & {
  subject?: { _id: Types.ObjectId; name: string } | Types.ObjectId;
  topic?: { _id: Types.ObjectId; name: string } | Types.ObjectId;
  exams?: Array<{ _id: Types.ObjectId; name: string } | Types.ObjectId>;
};

@Injectable()
export class AdminQuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Topic.name) private readonly topicModel: Model<TopicDocument>,
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<QuestionResponseDto> {
    this.validateQuestionContent(createQuestionDto);
    await this.validateReferences(createQuestionDto);

    const question = new this.questionModel(
      this.buildQuestionData(createQuestionDto),
    );
    await question.save();

    return this.findOne(question._id.toString());
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    subjectId?: string,
    topicId?: string,
    examId?: string,
    difficultyLevel?: string,
    tagId?: string,
  ): Promise<PaginatedQuestionsResponseDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<Question> = {};

    if (subjectId) {
      query.subject = new Types.ObjectId(subjectId);
    }
    if (topicId) {
      query.topic = new Types.ObjectId(topicId);
    }
    if (examId) {
      query.exams = new Types.ObjectId(examId);
    }
    if (difficultyLevel) {
      query.difficultyLevel = difficultyLevel;
    }
    if (tagId) {
      query.tag = new Types.ObjectId(tagId);
    }

    const [questions, total] = await Promise.all([
      this.questionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .populate('subject', 'name')
        .populate('topic', 'name')
        .populate('exams', 'name')
        .exec(),
      this.questionModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit);

    return {
      data: questions.map(question =>
        this.toResponseDto(question as PopulatedQuestion),
      ),
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

  async findOne(id: string): Promise<QuestionResponseDto> {
    const question = await this.questionModel
      .findById(id)
      .populate('subject', 'name')
      .populate('topic', 'name')
      .populate('exams', 'name')
      .exec();

    if (!question) {
      throw new NotFoundException(`Question with ID "${id}" not found`);
    }

    return this.toResponseDto(question as PopulatedQuestion);
  }

  async update(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    this.validateQuestionContent(updateQuestionDto);
    await this.validateReferences(updateQuestionDto);

    const question = await this.questionModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: this.buildQuestionData(updateQuestionDto) },
        { new: true, runValidators: true },
      )
      .populate('subject', 'name')
      .populate('topic', 'name')
      .populate('exams', 'name')
      .exec();

    if (!question) {
      throw new NotFoundException(`Question with ID "${id}" not found`);
    }

    return this.toResponseDto(question as PopulatedQuestion);
  }

  async remove(id: string): Promise<{ message: string }> {
    const question = await this.questionModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!question) {
      throw new NotFoundException(`Question with ID "${id}" not found`);
    }

    return { message: 'Question deleted successfully' };
  }

  private validateQuestionContent(dto: CreateQuestionDto): void {
    if (!dto.questionText?.en?.text) {
      throw new BadRequestException('English question text is required');
    }

    if (!dto.options || dto.options.length !== 4) {
      throw new BadRequestException('Exactly 4 options are required');
    }

    if (!dto.correctAnswer) {
      throw new BadRequestException('Correct answer is required');
    }

    const optionIds = dto.options.map(option => option.id);
    if (!optionIds.includes(dto.correctAnswer)) {
      throw new BadRequestException(
        'Correct answer must match one of the option IDs',
      );
    }
  }

  private async validateReferences(dto: CreateQuestionDto): Promise<void> {
    if (dto.subject) {
      const subject = await this.subjectModel.findById(dto.subject);
      if (!subject) {
        throw new BadRequestException(
          `Subject with ID "${dto.subject}" not found`,
        );
      }
    }

    if (dto.topic) {
      const topic = await this.topicModel.findById(dto.topic);
      if (!topic) {
        throw new BadRequestException(
          `Topic with ID "${dto.topic}" not found`,
        );
      }
    }

    if (dto.exams?.length) {
      for (const examId of dto.exams) {
        const exam = await this.examModel.findById(examId);
        if (!exam) {
          throw new BadRequestException(
            `Exam with ID "${examId}" not found`,
          );
        }
      }
    }

    if (dto.tag) {
      const tag = await this.tagModel.findById(dto.tag);
      if (!tag) {
        throw new BadRequestException(`Tag with ID "${dto.tag}" not found`);
      }
    }
  }

  private buildQuestionData(dto: CreateQuestionDto): Record<string, unknown> {
    const questionData: Record<string, unknown> = {
      questionText: {
        en: {
          text: dto.questionText.en.text,
          image: dto.questionText.en.image ?? null,
        },
        ml: {
          text: dto.questionText.ml?.text ?? null,
          image: dto.questionText.ml?.image ?? null,
        },
      },
      optionType: dto.optionType ?? 'text',
      explanation: {
        en: dto.explanation?.en ?? null,
        ml: dto.explanation?.ml ?? null,
        image: dto.explanation?.image ?? null,
      },
      options: dto.options.map(option => ({
        id: option.id,
        type: option.type ?? 'text',
        en: option.en,
        ml: option.ml ?? null,
        image: option.image ?? null,
      })),
      correctAnswer: dto.correctAnswer,
    };

    if (dto.subject) {
      questionData.subject = new Types.ObjectId(dto.subject);
    }
    if (dto.topic) {
      questionData.topic = new Types.ObjectId(dto.topic);
    }
    if (dto.exams?.length) {
      questionData.exams = dto.exams.map(id => new Types.ObjectId(id));
    }
    if (dto.tag) {
      questionData.tag = new Types.ObjectId(dto.tag);
    }
    if (dto.difficultyLevel) {
      questionData.difficultyLevel = dto.difficultyLevel;
    }

    return questionData;
  }

  private toPopulatedRef(
    ref:
      | { _id: Types.ObjectId; name: string }
      | Types.ObjectId
      | undefined,
  ): PopulatedRefDto | Types.ObjectId | undefined {
    if (!ref) {
      return undefined;
    }

    if (ref instanceof Types.ObjectId) {
      return ref;
    }

    return {
      _id: ref._id,
      name: ref.name,
    };
  }

  private toResponseDto(question: PopulatedQuestion): QuestionResponseDto {
    const obj = question.toObject({ transform: false, virtuals: false });

    const exams = Array.isArray(obj.exams)
      ? obj.exams.map(exam => this.toPopulatedRef(exam as never))
      : undefined;

    return new QuestionResponseDto({
      _id: obj._id,
      questionText: obj.questionText,
      optionType: obj.optionType,
      options: obj.options,
      explanation: obj.explanation,
      correctAnswer: obj.correctAnswer,
      subject: this.toPopulatedRef(obj.subject as never),
      topic: this.toPopulatedRef(obj.topic as never),
      exams: exams as PopulatedRefDto[] | Types.ObjectId[] | undefined,
      tag: obj.tag,
      difficultyLevel: obj.difficultyLevel,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    });
  }
}
