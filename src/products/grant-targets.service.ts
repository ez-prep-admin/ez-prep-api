import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { PaperType } from '../common/enums/paper-type.enum';
import {
  ExamGroup,
  ExamGroupDocument,
} from '../exam-groups/schemas/exam-group.schema';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { GrantTargetDto } from './dto/grant-target.dto';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_IDS = 100;
const KNOWN_PAPER_TYPES = [
  PaperType.TOPIC_WISE,
  PaperType.SPRINT,
  PaperType.FULL_EXAM,
];

const KIND_PREFIX = /^(topic|sprint|full)(?:\s*[·•]\s*|\s+)?(.*)$/i;

export interface GrantTargetSearchParams {
  scopeType?: string;
  search?: string;
  page?: number;
  limit?: number;
  ids?: string;
}

interface ListedTargets {
  data: GrantTargetDto[];
  pagination: PaginationMetaDto;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function contains(value: string): { $regex: string; $options: 'i' } {
  return { $regex: escapeRegex(value), $options: 'i' };
}

function paperTypeForKindWord(word: string): PaperType | undefined {
  switch (word.toLowerCase()) {
    case 'topic':
      return PaperType.TOPIC_WISE;
    case 'sprint':
      return PaperType.SPRINT;
    case 'full':
      return PaperType.FULL_EXAM;
    default:
      return undefined;
  }
}

function docId(row: { _id?: unknown; id?: unknown }): string {
  if (row._id != null && row._id !== '') return String(row._id);
  if (typeof row.id === 'string') return row.id;
  return '';
}

function examGroupLabel(
  name?: string | null,
  shortName?: string | null,
): string {
  const trimmedName = name?.trim() || 'Untitled';
  const trimmedShort = shortName?.trim();
  return trimmedShort ? `${trimmedName} (${trimmedShort})` : trimmedName;
}

function mockTestLabel(
  paperType: string | undefined,
  title: string | undefined | null,
  id: string,
): string {
  const kind =
    paperType === PaperType.SPRINT
      ? 'Sprint'
      : paperType === PaperType.FULL_EXAM
        ? 'Full'
        : 'Topic';
  const name = title?.trim() || id || 'Untitled';
  return `${kind} · ${name}`;
}

function paginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMetaDto {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1 && totalPages > 0,
  };
}

@Injectable()
export class GrantTargetsService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(ExamGroup.name)
    private readonly examGroupModel: Model<ExamGroupDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
  ) {}

  async search(params: GrantTargetSearchParams): Promise<ListedTargets> {
    const scopeType = this.parseScopeType(params.scopeType);
    const ids = this.parseIds(params.ids);
    if (ids) {
      const data = await this.findByIds(scopeType, ids);
      return {
        data,
        pagination: paginationMeta(data.length, 1, Math.max(ids.length, 1)),
      };
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(
      Math.max(1, params.limit || DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const search = params.search?.trim() || undefined;

    if (scopeType === EntitlementScopeType.EXAM_GROUP) {
      return this.searchExamGroups(search, page, limit);
    }
    if (scopeType === EntitlementScopeType.EXAM) {
      return this.searchExams(search, page, limit);
    }
    return this.searchMockTests(search, page, limit);
  }

  private parseScopeType(scopeType?: string): EntitlementScopeType {
    if (
      scopeType === EntitlementScopeType.EXAM_GROUP ||
      scopeType === EntitlementScopeType.EXAM ||
      scopeType === EntitlementScopeType.MOCK_TEST
    ) {
      return scopeType;
    }
    throw new BadRequestException('Invalid scopeType');
  }

  private parseIds(ids?: string): Types.ObjectId[] | undefined {
    if (ids == null || !ids.trim()) return undefined;
    const parts = Array.from(
      new Set(
        ids
          .split(',')
          .map(part => part.trim())
          .filter(Boolean),
      ),
    );
    if (parts.length > MAX_IDS) {
      throw new BadRequestException('Too many ids');
    }
    if (parts.some(id => !Types.ObjectId.isValid(id))) {
      throw new BadRequestException('Invalid scope id');
    }
    return parts.map(id => new Types.ObjectId(id));
  }

  private async searchExamGroups(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<ListedTargets> {
    const filter: FilterQuery<ExamGroupDocument> = {
      isDeleted: { $ne: true },
    };
    if (search) {
      const rx = contains(search);
      filter.$or = [{ name: rx }, { shortName: rx }];
    }
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.examGroupModel
        .find(filter)
        .select('name shortName')
        .sort({ name: 1, shortName: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.examGroupModel.countDocuments(filter).exec(),
    ]);
    return {
      data: rows.map(row => ({
        id: docId(row),
        label: examGroupLabel(row.name, row.shortName),
      })),
      pagination: paginationMeta(total, page, limit),
    };
  }

  private async searchExams(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<ListedTargets> {
    const filter: FilterQuery<ExamDocument> = {
      isDeleted: { $ne: true },
    };
    if (search) {
      filter.name = contains(search);
    }
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.examModel
        .find(filter)
        .select('name')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.examModel.countDocuments(filter).exec(),
    ]);
    return {
      data: rows.map(row => ({
        id: docId(row),
        label: row.name?.trim() || docId(row) || 'Untitled',
      })),
      pagination: paginationMeta(total, page, limit),
    };
  }

  private async searchMockTests(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<ListedTargets> {
    const filter = this.mockTestFilter(search);
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.mockTestModel
        .find(filter)
        .select('title paperType')
        .sort({ paperType: 1, title: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.mockTestModel.countDocuments(filter).exec(),
    ]);
    return {
      data: rows.map(row => {
        const id = docId(row);
        return {
          id,
          label: mockTestLabel(row.paperType, row.title, id),
        };
      }),
      pagination: paginationMeta(total, page, limit),
    };
  }

  private mockTestFilter(
    search?: string,
    ids?: Types.ObjectId[],
  ): FilterQuery<MockTestDocument> {
    const filter: FilterQuery<MockTestDocument> = {
      isDeleted: { $ne: true },
      paperType: { $in: KNOWN_PAPER_TYPES },
    };
    if (ids) {
      filter._id = { $in: ids };
      return filter;
    }
    if (!search) return filter;

    const fullRx = contains(search);
    const clauses: FilterQuery<MockTestDocument>[] = [
      { title: fullRx },
      { description: fullRx },
    ];
    const kindMatch = KIND_PREFIX.exec(search);
    if (kindMatch) {
      const paperType = paperTypeForKindWord(kindMatch[1]);
      const rest = kindMatch[2].trim();
      if (paperType && !rest) {
        clauses.push({ paperType });
      } else if (paperType && rest) {
        const restRx = contains(rest);
        clauses.push({
          paperType,
          $or: [{ title: restRx }, { description: restRx }],
        });
      }
    }
    filter.$or = clauses;
    return filter;
  }

  private async findByIds(
    scopeType: EntitlementScopeType,
    ids: Types.ObjectId[],
  ): Promise<GrantTargetDto[]> {
    if (scopeType === EntitlementScopeType.EXAM_GROUP) {
      const rows = await this.examGroupModel
        .find({ _id: { $in: ids }, isDeleted: { $ne: true } })
        .select('name shortName')
        .lean()
        .exec();
      return rows
        .map(row => ({
          id: docId(row),
          label: examGroupLabel(row.name, row.shortName),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    if (scopeType === EntitlementScopeType.EXAM) {
      const rows = await this.examModel
        .find({ _id: { $in: ids }, isDeleted: { $ne: true } })
        .select('name')
        .lean()
        .exec();
      return rows
        .map(row => ({
          id: docId(row),
          label: row.name?.trim() || docId(row) || 'Untitled',
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    const rows = await this.mockTestModel
      .find(this.mockTestFilter(undefined, ids))
      .select('title paperType')
      .lean()
      .exec();
    return rows
      .map(row => {
        const id = docId(row);
        return { id, label: mockTestLabel(row.paperType, row.title, id) };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}
