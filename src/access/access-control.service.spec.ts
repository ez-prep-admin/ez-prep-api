import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccessControlService } from './access-control.service';
import { AccessDecisionReason } from '../common/enums/access-decision-reason.enum';
import { AccessEnforcementMode } from '../common/enums/access-enforcement-mode.enum';
import { AccessMode } from '../common/enums/access-mode.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { Exam } from '../exams/schemas/exam.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';

const USER_ID = '507f1f77bcf86cd799439011';
const MOCK_ID = '507f1f77bcf86cd799439021';
const EXAM_ID = '507f1f77bcf86cd799439022';
const GROUP_ID = '507f1f77bcf86cd799439023';
const OTHER_EXAM = '507f1f77bcf86cd799439024';

describe('AccessControlService', () => {
  let service: AccessControlService;

  const mockTestModel: any = { findById: jest.fn() };
  const examModel: any = { findById: jest.fn() };
  const entitlementsService = {
    findActiveForUser: jest.fn(),
  };
  let enforcementMode = AccessEnforcementMode.ENFORCED;
  const configService = {
    get: jest.fn((key: string) =>
      key === 'ACCESS_ENFORCEMENT_MODE' ? enforcementMode : undefined,
    ),
  };

  beforeEach(async () => {
    enforcementMode = AccessEnforcementMode.ENFORCED;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
        { provide: getModelToken(Exam.name), useValue: examModel },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AccessControlService);
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) =>
      key === 'ACCESS_ENFORCEMENT_MODE' ? enforcementMode : undefined,
    );
  });

  function mockPaper(accessMode: AccessMode, active = true) {
    mockTestModel.findById.mockReturnValue({
      exec: () =>
        Promise.resolve({
          _id: new Types.ObjectId(MOCK_ID),
          exam: new Types.ObjectId(EXAM_ID),
          accessMode,
          isActive: active,
        }),
    });
  }

  function mockExam() {
    examModel.findById.mockReturnValue({
      exec: () =>
        Promise.resolve({
          _id: new Types.ObjectId(EXAM_ID),
          examGroup: new Types.ObjectId(GROUP_ID),
        }),
    });
  }

  it('FREE → allow regardless of entitlements / mode', async () => {
    mockPaper(AccessMode.FREE);
    entitlementsService.findActiveForUser.mockResolvedValue([]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision).toEqual({
      allowed: true,
      reason: AccessDecisionReason.ALLOWED,
      accessMode: AccessMode.FREE,
    });
    expect(entitlementsService.findActiveForUser).not.toHaveBeenCalled();
  });

  it('ENTITLED + MOCK_TEST entitlement → allow', async () => {
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    entitlementsService.findActiveForUser.mockResolvedValue([
      {
        scopeType: EntitlementScopeType.MOCK_TEST,
        scopeId: new Types.ObjectId(MOCK_ID),
        status: EntitlementStatus.ACTIVE,
      },
    ]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe(AccessDecisionReason.ALLOWED);
  });

  it('ENTITLED + EXAM entitlement → allow', async () => {
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    entitlementsService.findActiveForUser.mockResolvedValue([
      {
        scopeType: EntitlementScopeType.EXAM,
        scopeId: new Types.ObjectId(EXAM_ID),
        status: EntitlementStatus.ACTIVE,
      },
    ]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe(AccessDecisionReason.ALLOWED);
  });

  it('ENTITLED + EXAM_GROUP entitlement → allow', async () => {
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    entitlementsService.findActiveForUser.mockResolvedValue([
      {
        scopeType: EntitlementScopeType.EXAM_GROUP,
        scopeId: new Types.ObjectId(GROUP_ID),
        status: EntitlementStatus.ACTIVE,
      },
    ]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe(AccessDecisionReason.ALLOWED);
  });

  it('ENTITLED + none + ENFORCED → deny ENTITLEMENT_REQUIRED', async () => {
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    entitlementsService.findActiveForUser.mockResolvedValue([]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision).toEqual({
      allowed: false,
      reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
      accessMode: AccessMode.ENTITLED,
    });
  });

  it('ENTITLED + none + LEGACY → allow LEGACY_ALLOW', async () => {
    enforcementMode = AccessEnforcementMode.LEGACY;
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    entitlementsService.findActiveForUser.mockResolvedValue([]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision).toEqual({
      allowed: true,
      reason: AccessDecisionReason.LEGACY_ALLOW,
      accessMode: AccessMode.ENTITLED,
    });
  });

  it('expired / revoked entitlements are already filtered → deny under ENFORCED', async () => {
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    // findActiveForUser returns only currently active; empty means expired/revoked filtered out
    entitlementsService.findActiveForUser.mockResolvedValue([]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe(AccessDecisionReason.ENTITLEMENT_REQUIRED);
  });

  it('wrong exam entitlement → deny under ENFORCED', async () => {
    mockPaper(AccessMode.ENTITLED);
    mockExam();
    entitlementsService.findActiveForUser.mockResolvedValue([
      {
        scopeType: EntitlementScopeType.EXAM,
        scopeId: new Types.ObjectId(OTHER_EXAM),
        status: EntitlementStatus.ACTIVE,
      },
    ]);

    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe(AccessDecisionReason.ENTITLEMENT_REQUIRED);
  });

  it('inactive mock test → INACTIVE', async () => {
    mockPaper(AccessMode.FREE, false);
    const decision = await service.canAccessMockTest(USER_ID, MOCK_ID);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe(AccessDecisionReason.INACTIVE);
  });
});
