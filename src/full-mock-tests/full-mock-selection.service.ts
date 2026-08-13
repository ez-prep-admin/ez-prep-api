import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Exam, ExamDocument, ExamSubject } from '../exams/schemas/exam.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Topic, TopicDocument } from '../topics/schemas/topic.schema';
import {
  Question,
  QuestionDocument,
} from '../mock-test-attempts/schemas/question.schema';
import { DraftQuestion } from './schemas/full-mock-test-draft.schema';

const RECENCY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const USAGE_EXPONENT = 1.5;

interface EligibleQuestion {
  _id: Types.ObjectId;
  topic?: Types.ObjectId;
  difficultyLevel?: string;
  fullMockUsageCount?: number;
  lastUsedInFullMockAt?: Date;
}

interface TopicInventory {
  topicId: Types.ObjectId | null;
  inventory: number;
  quota: number;
  frac: number;
}

export interface GeneratedPaper {
  questions: DraftQuestion[];
  subjectNames: Map<string, string>;
}

@Injectable()
export class FullMockSelectionService {
  private readonly logger = new Logger(FullMockSelectionService.name);

  constructor(
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
  ) {}

  /**
   * Validate exam blueprint then sample a full paper.
   * Throws 400 with BLUEPRINT_INVALID or BANK_SHORTAGE — nothing is persisted here.
   */
  async generatePaper(exam: ExamDocument): Promise<GeneratedPaper> {
    this.assertBlueprint(exam);

    const usedIds = new Set<string>();
    const questions: DraftQuestion[] = [];
    const subjectNames = new Map<string, string>();
    let position = 0;

    for (const row of exam.subjects) {
      const subjectId = row.subject as Types.ObjectId;
      if (!subjectId) {
        throw new BadRequestException({
          message: 'Exam blueprint is inconsistent',
          error: 'BLUEPRINT_INVALID',
          details: [{ rule: 'SUBJECT_REQUIRED' }],
        });
      }
      const subject = await this.subjectModel.findById(subjectId).exec();
      if (!subject) {
        throw new BadRequestException({
          message: 'Exam blueprint is inconsistent',
          error: 'BLUEPRINT_INVALID',
          details: [
            {
              rule: 'SUBJECT_MISSING',
              subjectId: subjectId.toString(),
            },
          ],
        });
      }

      subjectNames.set(subjectId.toString(), subject.name);

      const negativeMarking = row.hasNegativeMarking
        ? row.negativeMarksPerQuestion || 0
        : 0;

      const picks = await this.sampleSubject(row, subject, usedIds);

      for (const pick of picks) {
        questions.push({
          question: pick._id,
          subject: subjectId,
          topic: pick.topic,
          difficultyLevel: pick.difficultyLevel,
          position,
          marksPerQuestion: row.marksPerQuestion,
          negativeMarking,
        });
        usedIds.add(pick._id.toString());
        position += 1;
      }
    }

    if (questions.length !== exam.totalQuestions) {
      this.logger.error(
        `Generated ${questions.length} questions, expected ${exam.totalQuestions}`,
      );
      throw new BadRequestException({
        message: 'Failed to assemble a complete paper',
        error: 'BANK_SHORTAGE',
        details: {
          needed: exam.totalQuestions,
          available: questions.length,
        },
      });
    }

    const uniqueIds = new Set(questions.map(q => q.question.toString()));
    if (uniqueIds.size !== questions.length) {
      throw new BadRequestException({
        message:
          'Generated paper contained the same question more than once. Try generating again.',
        error: 'DUPLICATE_QUESTION',
      });
    }

    return { questions, subjectNames };
  }

  assertBlueprint(exam: Exam): void {
    const details: Array<Record<string, unknown>> = [];

    if (!exam.subjects || exam.subjects.length < 1) {
      details.push({ rule: 'SUBJECTS_REQUIRED' });
    }

    (exam.subjects || []).forEach((row, index) => {
      if (!row?.subject) {
        details.push({ rule: 'SUBJECT_REQUIRED', index });
      }
    });

    const subjectSum = (exam.subjects || []).reduce(
      (sum, row) => sum + (row.numberOfQuestions || 0),
      0,
    );

    if (exam.totalQuestions == null) {
      details.push({ rule: 'TOTAL_QUESTIONS_REQUIRED' });
    } else if (subjectSum !== exam.totalQuestions) {
      details.push({
        rule: 'TOTAL_QUESTIONS_MISMATCH',
        expected: exam.totalQuestions,
        actual: subjectSum,
      });
    }

    if (exam.totalMarks != null) {
      const marksSum = (exam.subjects || []).reduce(
        (sum, row) =>
          sum + (row.numberOfQuestions || 0) * (row.marksPerQuestion || 0),
        0,
      );
      if (marksSum !== exam.totalMarks) {
        details.push({
          rule: 'TOTAL_MARKS_MISMATCH',
          expected: exam.totalMarks,
          actual: marksSum,
        });
      }
    }

    if (!exam.isSessionWise) {
      if (exam.duration == null || exam.duration <= 0) {
        details.push({ rule: 'DURATION_REQUIRED' });
      }
    } else {
      const missingSession = (exam.subjects || []).filter(
        row => row.sessionTime == null || row.sessionTime <= 0,
      );
      if (missingSession.length > 0) {
        details.push({
          rule: 'SESSION_TIME_REQUIRED',
          subjects: missingSession.map(row => row.subject?.toString()),
        });
      }
    }

    if (details.length > 0) {
      throw new BadRequestException({
        message: 'Exam blueprint is inconsistent',
        error: 'BLUEPRINT_INVALID',
        details,
      });
    }
  }

  private async sampleSubject(
    row: ExamSubject,
    subject: SubjectDocument,
    usedIds: Set<string>,
  ): Promise<EligibleQuestion[]> {
    const needed = row.numberOfQuestions;
    const subjectId = subject._id as Types.ObjectId;

    const topicIds = (subject.topics || []).map(id => id as Types.ObjectId);
    const activeTopics =
      topicIds.length > 0
        ? await this.topicModel
            .find({
              _id: { $in: topicIds },
              isActive: true,
            })
            .select('_id')
            .lean()
            .exec()
        : [];

    const buckets: TopicInventory[] =
      activeTopics.length === 0
        ? [
            {
              topicId: null,
              inventory: await this.countEligible(subjectId, null, usedIds),
              quota: 0,
              frac: 0,
            },
          ]
        : await Promise.all(
            activeTopics.map(async topic => ({
              topicId: topic._id as Types.ObjectId,
              inventory: await this.countEligible(
                subjectId,
                topic._id as Types.ObjectId,
                usedIds,
              ),
              quota: 0,
              frac: 0,
            })),
          );

    const usable = buckets.filter(b => b.inventory > 0);
    const available = usable.reduce((sum, b) => sum + b.inventory, 0);

    if (available < needed) {
      throw new BadRequestException({
        message: 'Not enough questions for subject',
        error: 'BANK_SHORTAGE',
        details: {
          subjectId: subjectId.toString(),
          subjectName: subject.name,
          needed,
          available,
        },
      });
    }

    this.allocateLargestRemainder(usable, needed);

    const picked: EligibleQuestion[] = [];
    for (const bucket of usable) {
      if (bucket.quota <= 0) {
        continue;
      }
      const pool = await this.loadEligible(subjectId, bucket.topicId, usedIds);
      const sample = this.weightedSample(pool, bucket.quota);
      if (sample.length < bucket.quota) {
        throw new BadRequestException({
          message: 'Not enough questions for subject',
          error: 'BANK_SHORTAGE',
          details: {
            subjectId: subjectId.toString(),
            subjectName: subject.name,
            needed,
            available: picked.length + sample.length,
          },
        });
      }
      for (const q of sample) {
        usedIds.add(q._id.toString());
        picked.push(q);
      }
    }

    return picked;
  }

  private eligibleMatch(
    subjectId: Types.ObjectId,
    topicId: Types.ObjectId | null,
    usedIds: Set<string>,
  ) {
    const match: Record<string, unknown> = {
      subject: subjectId,
      isActive: true,
      difficultyLevel: { $in: ['easy', 'medium', 'hard'] },
    };
    if (topicId) {
      match.topic = topicId;
    }
    if (usedIds.size > 0) {
      match._id = {
        $nin: [...usedIds].map(id => new Types.ObjectId(id)),
      };
    }
    return match;
  }

  private countEligible(
    subjectId: Types.ObjectId,
    topicId: Types.ObjectId | null,
    usedIds: Set<string>,
  ): Promise<number> {
    return this.questionModel
      .countDocuments(this.eligibleMatch(subjectId, topicId, usedIds))
      .exec();
  }

  private async loadEligible(
    subjectId: Types.ObjectId,
    topicId: Types.ObjectId | null,
    usedIds: Set<string>,
  ): Promise<EligibleQuestion[]> {
    const docs = await this.questionModel
      .find(this.eligibleMatch(subjectId, topicId, usedIds))
      .select(
        '_id topic difficultyLevel fullMockUsageCount lastUsedInFullMockAt',
      )
      .lean()
      .exec();
    return docs as unknown as EligibleQuestion[];
  }

  /**
   * Largest-remainder allocation, capped by inventory, leftover spilled to spare.
   */
  allocateLargestRemainder(buckets: TopicInventory[], seats: number): void {
    const totalInv = buckets.reduce((sum, b) => sum + b.inventory, 0);
    if (totalInv <= 0 || seats <= 0) {
      return;
    }

    for (const bucket of buckets) {
      const raw = (seats * bucket.inventory) / totalInv;
      bucket.quota = Math.floor(raw);
      bucket.frac = raw - Math.floor(raw);
    }

    let remainder = seats - buckets.reduce((sum, b) => sum + b.quota, 0);

    const byFrac = [...buckets].sort((a, b) => b.frac - a.frac);
    for (const bucket of byFrac) {
      if (remainder <= 0) {
        break;
      }
      if (bucket.quota < bucket.inventory) {
        bucket.quota += 1;
        remainder -= 1;
      }
    }

    if (remainder > 0) {
      const bySpare = [...buckets].sort(
        (a, b) => b.inventory - b.quota - (a.inventory - a.quota),
      );
      for (const bucket of bySpare) {
        if (remainder <= 0) {
          break;
        }
        const spare = bucket.inventory - bucket.quota;
        if (spare <= 0) {
          continue;
        }
        const add = Math.min(spare, remainder);
        bucket.quota += add;
        remainder -= add;
      }
    }
  }

  weightedSample(pool: EligibleQuestion[], count: number): EligibleQuestion[] {
    const remaining = [...pool];
    const picked: EligibleQuestion[] = [];

    while (picked.length < count && remaining.length > 0) {
      const weights = remaining.map(q => this.questionWeight(q));
      const total = weights.reduce((sum, w) => sum + w, 0);
      let cursor = Math.random() * total;
      let index = remaining.length - 1;
      for (let i = 0; i < remaining.length; i++) {
        cursor -= weights[i];
        if (cursor <= 0) {
          index = i;
          break;
        }
      }
      picked.push(remaining.splice(index, 1)[0]);
    }

    return picked;
  }

  private questionWeight(question: EligibleQuestion): number {
    const usage = question.fullMockUsageCount || 0;
    const usedAt = question.lastUsedInFullMockAt
      ? new Date(question.lastUsedInFullMockAt).getTime()
      : 0;
    const recencyPenalty =
      usedAt > 0 && Date.now() - usedAt < RECENCY_WINDOW_MS ? 0.4 : 1;
    const jitter = 0.85 + 0.15 * Math.random();
    return (1 / Math.pow(1 + usage, USAGE_EXPONENT)) * recencyPenalty * jitter;
  }
}
