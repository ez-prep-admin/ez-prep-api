import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessDecision } from './access-decision';
import { entitlementCoversPaper } from './match-entitlement';
import { PaperAccessInput } from './paper-access-input';
import { AccessDecisionReason } from '../common/enums/access-decision-reason.enum';
import { AccessEnforcementMode } from '../common/enums/access-enforcement-mode.enum';
import { AccessMode } from '../common/enums/access-mode.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';

/**
 * Sole authorizer for mock-test access (access-control.md).
 * Controllers and frontends must not reimplement grant hierarchy.
 *
 * Do not consult User.subscription / membershipTier (D-06, R-13).
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
    private readonly entitlementsService: EntitlementsService,
    private readonly commerceConfig: CommerceConfigService,
  ) {}

  async canAccessMockTest(
    userId: string,
    mockTestId: string,
  ): Promise<AccessDecision> {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(mockTestId)
    ) {
      return {
        allowed: false,
        reason: AccessDecisionReason.INACTIVE,
      };
    }

    const mockTest = await this.mockTestModel.findById(mockTestId).exec();
    if (!mockTest || mockTest.isActive === false) {
      return {
        allowed: false,
        reason: AccessDecisionReason.INACTIVE,
        accessMode: mockTest?.accessMode,
      };
    }

    const map = await this.resolveAccessForMockTests(userId, [
      {
        id: String(mockTest._id),
        accessMode: mockTest.accessMode,
        examId: mockTest.exam ? String(mockTest.exam) : null,
        isActive: true,
      },
    ]);

    return (
      map.get(String(mockTest._id)) ?? {
        allowed: false,
        reason: AccessDecisionReason.INACTIVE,
        accessMode: mockTest.accessMode,
      }
    );
  }

  /**
   * Batch access resolution for list/get endpoints.
   * Loads entitlements once and exams in one query — no per-item DB explosion.
   *
   * When `userId` is null/undefined/invalid: FREE → ALLOWED; ENTITLED → ENTITLEMENT_REQUIRED
   * (no LEGACY_ALLOW without a user).
   */
  async resolveAccessForMockTests(
    userId: string | null | undefined,
    papers: PaperAccessInput[],
  ): Promise<Map<string, AccessDecision>> {
    const result = new Map<string, AccessDecision>();
    if (papers.length === 0) {
      return result;
    }

    const entitledExamIds = new Set<string>();
    for (const paper of papers) {
      if (paper.isActive === false) {
        result.set(paper.id, {
          allowed: false,
          reason: AccessDecisionReason.INACTIVE,
          accessMode: paper.accessMode,
        });
        continue;
      }

      if (paper.accessMode === AccessMode.FREE) {
        result.set(paper.id, {
          allowed: true,
          reason: AccessDecisionReason.ALLOWED,
          accessMode: AccessMode.FREE,
        });
        continue;
      }

      // ENTITLED (or unknown treated as entitled path)
      if (paper.examId && Types.ObjectId.isValid(paper.examId)) {
        entitledExamIds.add(paper.examId);
      }
    }

    const pending = papers.filter(p => !result.has(p.id));
    if (pending.length === 0) {
      return result;
    }

    const hasValidUser = !!userId && Types.ObjectId.isValid(userId);
    const entitlements = hasValidUser
      ? await this.entitlementsService.findActiveForUser(userId)
      : [];

    const examIds = [...entitledExamIds].map(id => new Types.ObjectId(id));
    const exams =
      examIds.length > 0
        ? await this.examModel.find({ _id: { $in: examIds } }).exec()
        : [];
    const examById = new Map(
      exams.map(exam => [
        String(exam._id),
        { examId: String(exam._id), examGroupId: String(exam.examGroup) },
      ]),
    );

    const mode = this.getEnforcementMode();
    let legacyAllow = 0;
    let entitlementRequired = 0;

    for (const paper of pending) {
      const mockMatch = entitlements.some(
        entitlement =>
          entitlement.scopeType === EntitlementScopeType.MOCK_TEST &&
          String(entitlement.scopeId) === paper.id,
      );
      if (mockMatch) {
        if (!hasValidUser) {
          result.set(paper.id, {
            allowed: false,
            reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
            accessMode: AccessMode.ENTITLED,
          });
          continue;
        }
        result.set(paper.id, {
          allowed: true,
          reason: AccessDecisionReason.ALLOWED,
          accessMode: AccessMode.ENTITLED,
        });
        continue;
      }

      const examMeta = paper.examId ? examById.get(paper.examId) : undefined;
      if (!examMeta) {
        result.set(paper.id, {
          allowed: false,
          reason: AccessDecisionReason.INACTIVE,
          accessMode: AccessMode.ENTITLED,
        });
        continue;
      }

      if (!hasValidUser) {
        result.set(paper.id, {
          allowed: false,
          reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
          accessMode: AccessMode.ENTITLED,
        });
        continue;
      }

      const hasMatch = entitlementCoversPaper(
        entitlements,
        paper.id,
        examMeta.examId,
        examMeta.examGroupId,
      );

      if (hasMatch) {
        result.set(paper.id, {
          allowed: true,
          reason: AccessDecisionReason.ALLOWED,
          accessMode: AccessMode.ENTITLED,
        });
        continue;
      }

      if (mode === AccessEnforcementMode.LEGACY) {
        legacyAllow += 1;
        this.logger.debug(
          `LEGACY_ALLOW userId=${userId} mockTestId=${paper.id}`,
        );
        result.set(paper.id, {
          allowed: true,
          reason: AccessDecisionReason.LEGACY_ALLOW,
          accessMode: AccessMode.ENTITLED,
        });
        continue;
      }

      entitlementRequired += 1;
      this.logger.debug(
        `ENTITLEMENT_REQUIRED mockTestId=${paper.id} reason=${AccessDecisionReason.ENTITLEMENT_REQUIRED}`,
      );
      result.set(paper.id, {
        allowed: false,
        reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
        accessMode: AccessMode.ENTITLED,
      });
    }

    if (legacyAllow > 0 || entitlementRequired > 0) {
      this.logger.log(
        `Access list summary legacyAllow=${legacyAllow} entitlementRequired=${entitlementRequired}`,
      );
    }

    return result;
  }

  private getEnforcementMode(): AccessEnforcementMode {
    return this.commerceConfig.settings.accessEnforcementMode ===
      AccessEnforcementMode.ENFORCED
      ? AccessEnforcementMode.ENFORCED
      : AccessEnforcementMode.LEGACY;
  }
}
