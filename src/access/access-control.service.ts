import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessDecision } from './access-decision';
import { AccessDecisionReason } from '../common/enums/access-decision-reason.enum';
import { AccessEnforcementMode } from '../common/enums/access-enforcement-mode.enum';
import { AccessMode } from '../common/enums/access-mode.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
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
 * startAttempt wiring is phase 03 — this service is intentional unused by attempts until then.
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
    private readonly configService: ConfigService,
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

    if (mockTest.accessMode === AccessMode.FREE) {
      return {
        allowed: true,
        reason: AccessDecisionReason.ALLOWED,
        accessMode: AccessMode.FREE,
      };
    }

    const exam = await this.examModel.findById(mockTest.exam).exec();
    if (!exam) {
      return {
        allowed: false,
        reason: AccessDecisionReason.INACTIVE,
        accessMode: AccessMode.ENTITLED,
      };
    }

    const entitlements =
      await this.entitlementsService.findActiveForUser(userId);
    const mockTestIdStr = String(mockTest._id);
    const examIdStr = String(exam._id);
    const examGroupIdStr = String(exam.examGroup);

    const hasMatch = entitlements.some(entitlement => {
      const scopeId = String(entitlement.scopeId);
      if (
        entitlement.scopeType === EntitlementScopeType.MOCK_TEST &&
        scopeId === mockTestIdStr
      ) {
        return true;
      }
      if (
        entitlement.scopeType === EntitlementScopeType.EXAM &&
        scopeId === examIdStr
      ) {
        return true;
      }
      if (
        entitlement.scopeType === EntitlementScopeType.EXAM_GROUP &&
        scopeId === examGroupIdStr
      ) {
        return true;
      }
      return false;
    });

    if (hasMatch) {
      return {
        allowed: true,
        reason: AccessDecisionReason.ALLOWED,
        accessMode: AccessMode.ENTITLED,
      };
    }

    const mode = this.getEnforcementMode();
    if (mode === AccessEnforcementMode.LEGACY) {
      this.logger.warn(
        `LEGACY_ALLOW userId=${userId} mockTestId=${mockTestId}`,
      );
      return {
        allowed: true,
        reason: AccessDecisionReason.LEGACY_ALLOW,
        accessMode: AccessMode.ENTITLED,
      };
    }

    return {
      allowed: false,
      reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
      accessMode: AccessMode.ENTITLED,
    };
  }

  private getEnforcementMode(): AccessEnforcementMode {
    const raw = (
      this.configService.get<string>('ACCESS_ENFORCEMENT_MODE') ??
      AccessEnforcementMode.LEGACY
    ).toUpperCase();

    return raw === AccessEnforcementMode.ENFORCED
      ? AccessEnforcementMode.ENFORCED
      : AccessEnforcementMode.LEGACY;
  }
}
