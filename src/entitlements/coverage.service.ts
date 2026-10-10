import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { EntitlementSourceType } from '../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import {
  CoverageEntitlement,
  CoverageGrant,
  coveredForLife,
} from './domain/covered-for-life';
import { Entitlement, EntitlementDocument } from './schemas/entitlement.schema';

export type ProductOwnership = {
  coveredForLife: boolean;
  ownedUntil?: string | null;
};

@Injectable()
export class CoverageService {
  constructor(
    @InjectModel(Entitlement.name)
    private readonly entitlementModel: Model<EntitlementDocument>,
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
  ) {}

  async isCoveredForLife(
    userId: string,
    grants: CoverageGrant[],
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId) || grants.length === 0) {
      return false;
    }
    const rows = await this.loadUnexpired(userId);
    const context = await this.contextFor(grants);
    return coveredForLife(grants, rows, context, new Date());
  }

  /**
   * One entitlements read for a catalog response.
   * ownedUntil follows PAYMENT rows for that product, including a future stack.
   */
  async ownershipByProduct(
    userId: string,
    products: Array<{ id: string; grants: CoverageGrant[] }>,
  ): Promise<Map<string, ProductOwnership>> {
    const result = new Map<string, ProductOwnership>();
    if (!Types.ObjectId.isValid(userId) || products.length === 0) {
      return result;
    }

    const now = new Date();
    const rows = await this.loadUnexpired(userId);
    const grants = products.flatMap(product => product.grants);
    const context = await this.contextFor(grants);

    for (const product of products) {
      const paymentRows = rows.filter(
        row =>
          row.sourceType === EntitlementSourceType.PAYMENT &&
          row.productId === product.id,
      );
      let ownedUntil: string | null | undefined;
      if (paymentRows.length === 0) {
        ownedUntil = undefined;
      } else if (paymentRows.some(row => row.expiresAt == null)) {
        ownedUntil = null;
      } else {
        const last = paymentRows.reduce((max, row) => {
          const at = row.expiresAt?.getTime() ?? 0;
          return at > max ? at : max;
        }, 0);
        ownedUntil = new Date(last).toISOString();
      }

      result.set(product.id, {
        coveredForLife: coveredForLife(product.grants, rows, context, now),
        ownedUntil,
      });
    }

    return result;
  }

  private async loadUnexpired(
    userId: string,
  ): Promise<
    Array<CoverageEntitlement & { productId?: string; sourceType: string }>
  > {
    const now = new Date();
    const docs = await this.entitlementModel
      .find({
        userId: new Types.ObjectId(userId),
        status: EntitlementStatus.ACTIVE,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .exec();

    return docs.map(doc => ({
      scopeType: doc.scopeType,
      scopeId: String(doc.scopeId),
      startsAt: doc.startsAt,
      expiresAt: doc.expiresAt,
      status: doc.status,
      sourceType: doc.sourceType,
      productId: doc.productId ? String(doc.productId) : undefined,
    }));
  }

  private async contextFor(grants: CoverageGrant[]) {
    const paperIds = grants
      .filter(grant => grant.scopeType === EntitlementScopeType.MOCK_TEST)
      .map(grant => grant.scopeId)
      .filter(id => Types.ObjectId.isValid(id));
    const papers =
      paperIds.length === 0
        ? []
        : await this.mockTestModel
            .find({ _id: { $in: paperIds.map(id => new Types.ObjectId(id)) } })
            .select('exam')
            .lean()
            .exec();

    const paperExamId = new Map<string, string>();
    const examIds = new Set<string>();
    for (const grant of grants) {
      if (
        grant.scopeType === EntitlementScopeType.EXAM &&
        Types.ObjectId.isValid(grant.scopeId)
      ) {
        examIds.add(grant.scopeId);
      }
    }
    for (const paper of papers) {
      if (!paper.exam) {
        continue;
      }
      const examId = String(paper.exam);
      paperExamId.set(String(paper._id), examId);
      examIds.add(examId);
    }

    const exams =
      examIds.size === 0
        ? []
        : await this.examModel
            .find({
              _id: {
                $in: [...examIds].map(id => new Types.ObjectId(id)),
              },
            })
            .select('examGroup')
            .lean()
            .exec();
    const examGroupId = new Map<string, string>();
    for (const exam of exams) {
      if (exam.examGroup) {
        examGroupId.set(String(exam._id), String(exam.examGroup));
      }
    }

    return { paperExamId, examGroupId };
  }
}
