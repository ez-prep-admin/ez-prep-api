import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { EntitlementSourceType } from '../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { ExamGroup } from '../exam-groups/schemas/exam-group.schema';
import { Exam } from '../exams/schemas/exam.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';
import { User } from '../users/schemas/user.schema';
import { EntitlementsService } from './entitlements.service';
import { Entitlement } from './schemas/entitlement.schema';

const USER_ID = '507f1f77bcf86cd799439011';
const ADMIN_ID = '507f1f77bcf86cd799439012';
const SCOPE_ID = '507f1f77bcf86cd799439013';
const ENT_ID = '507f1f77bcf86cd799439014';

function entitlementDoc(overrides: Record<string, unknown> = {}) {
  const doc: any = {
    _id: new Types.ObjectId(ENT_ID),
    userId: new Types.ObjectId(USER_ID),
    scopeType: EntitlementScopeType.EXAM,
    scopeId: new Types.ObjectId(SCOPE_ID),
    status: EntitlementStatus.ACTIVE,
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-04-01T00:00:00.000Z'),
    sourceType: EntitlementSourceType.ADMIN_GRANT,
    sourceId: ADMIN_ID,
    provisioningKey: `admin:${ADMIN_ID}:test-key`,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };

  doc.save = jest.fn().mockResolvedValue(undefined);
  doc.toObject = () => ({
    id: String(doc._id),
    userId: doc.userId,
    scopeType: doc.scopeType,
    scopeId: doc.scopeId,
    status: doc.status,
    startsAt: doc.startsAt,
    expiresAt: doc.expiresAt,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    provisioningKey: doc.provisioningKey,
    revokedAt: doc.revokedAt,
    revokeReason: doc.revokeReason,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });

  return doc;
}

describe('EntitlementsService', () => {
  let service: EntitlementsService;

  const entitlementModel: any = jest.fn();
  entitlementModel.findById = jest.fn();
  entitlementModel.find = jest.fn();

  const userModel: any = { findById: jest.fn() };
  const examModel: any = { findById: jest.fn() };
  const examGroupModel: any = { findById: jest.fn() };
  const mockTestModel: any = { findById: jest.fn() };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        {
          provide: getModelToken(Entitlement.name),
          useValue: entitlementModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Exam.name), useValue: examModel },
        { provide: getModelToken(ExamGroup.name), useValue: examGroupModel },
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
        { provide: CommerceAuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(EntitlementsService);
    jest.clearAllMocks();
  });

  describe('grant', () => {
    it('grants an ADMIN_GRANT entitlement and writes audit log', async () => {
      const doc = entitlementDoc();
      entitlementModel.mockImplementation(() => doc);
      userModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: USER_ID }) }),
      });
      examModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: SCOPE_ID }) }),
      });

      const result = await service.grant(
        {
          userId: USER_ID,
          scopeType: EntitlementScopeType.EXAM,
          scopeId: SCOPE_ID,
          durationPreset: DurationPreset.THREE_MONTHS,
          reason: 'support',
        },
        { actorUserId: ADMIN_ID, provisioningKey: 'admin:fixed-key' },
      );

      expect(result.id).toBe(ENT_ID);
      expect(result.sourceType).toBe(EntitlementSourceType.ADMIN_GRANT);
      expect(doc.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ENTITLEMENT_GRANTED',
          actorUserId: ADMIN_ID,
        }),
      );
    });

    it('throws ConflictException on duplicate provisioningKey', async () => {
      const doc = entitlementDoc();
      doc.save.mockRejectedValue({ code: 11000 });
      entitlementModel.mockImplementation(() => doc);
      userModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: USER_ID }) }),
      });
      examModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: SCOPE_ID }) }),
      });

      await expect(
        service.grant(
          {
            userId: USER_ID,
            scopeType: EntitlementScopeType.EXAM,
            scopeId: SCOPE_ID,
            durationPreset: DurationPreset.LIFETIME,
          },
          { actorUserId: ADMIN_ID, provisioningKey: 'dup-key' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects unknown scope', async () => {
      userModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: USER_ID }) }),
      });
      examModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve(null) }),
      });

      await expect(
        service.grant(
          {
            userId: USER_ID,
            scopeType: EntitlementScopeType.EXAM,
            scopeId: SCOPE_ID,
            durationPreset: DurationPreset.ONE_MONTH,
          },
          { actorUserId: ADMIN_ID },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sets expiresAt approximately now + 3 calendar months for 3M', async () => {
      const before = Date.now();
      const doc = entitlementDoc();
      entitlementModel.mockImplementation(
        (payload: Record<string, unknown>) => {
          Object.assign(doc, payload);
          return doc;
        },
      );
      userModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: USER_ID }) }),
      });
      examModel.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: SCOPE_ID }) }),
      });

      await service.grant(
        {
          userId: USER_ID,
          scopeType: EntitlementScopeType.EXAM,
          scopeId: SCOPE_ID,
          durationPreset: DurationPreset.THREE_MONTHS,
        },
        { actorUserId: ADMIN_ID, provisioningKey: 'admin:3m-key' },
      );
      const after = Date.now();

      const expiresAt = doc.expiresAt as Date;
      expect(expiresAt).toBeInstanceOf(Date);

      const minExpected = new Date(before);
      minExpected.setUTCMonth(minExpected.getUTCMonth() + 3);
      const maxExpected = new Date(after);
      maxExpected.setUTCMonth(maxExpected.getUTCMonth() + 3);

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(minExpected.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpected.getTime());
    });
  });

  describe('revoke', () => {
    it('revokes an active entitlement', async () => {
      const doc = entitlementDoc();
      entitlementModel.findById.mockResolvedValue(doc);

      const result = await service.revoke(ENT_ID, ADMIN_ID, 'support revoke');

      expect(result.status).toBe(EntitlementStatus.REVOKED);
      expect(doc.status).toBe(EntitlementStatus.REVOKED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ENTITLEMENT_REVOKED' }),
      );
    });

    it('flips status to REVOKED and persists revokeReason', async () => {
      const doc = entitlementDoc();
      entitlementModel.findById.mockResolvedValue(doc);

      const result = await service.revoke(ENT_ID, ADMIN_ID, 'support revoke');

      expect(result.status).toBe(EntitlementStatus.REVOKED);
      expect(doc.status).toBe(EntitlementStatus.REVOKED);
      expect(doc.revokeReason).toBe('support revoke');
      expect(doc.revokedAt).toBeInstanceOf(Date);
      expect(doc.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when missing', async () => {
      entitlementModel.findById.mockResolvedValue(null);
      await expect(service.revoke(ENT_ID, ADMIN_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('listByUser / findActiveForUser', () => {
    it('filters inactive by default in listByUser', async () => {
      const active = entitlementDoc({
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      });
      const expired = entitlementDoc({
        _id: new Types.ObjectId('507f1f77bcf86cd799439015'),
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        provisioningKey: 'expired-key',
      });

      entitlementModel.find.mockReturnValue({
        sort: () => ({ exec: () => Promise.resolve([active, expired]) }),
      });

      const list = await service.listByUser(USER_ID);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(ENT_ID);
    });

    it('findActiveForUser returns only currently active docs', async () => {
      const active = entitlementDoc({
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      });
      const revoked = entitlementDoc({
        status: EntitlementStatus.REVOKED,
        expiresAt: null,
      });

      entitlementModel.find.mockReturnValue({
        exec: () => Promise.resolve([active, revoked]),
      });

      const activeList = await service.findActiveForUser(USER_ID);
      expect(activeList).toHaveLength(1);
    });
  });
});
