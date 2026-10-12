import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';

export type CoverageGrant = {
  scopeType: string;
  scopeId: string;
};

export type CoverageEntitlement = {
  scopeType: string;
  scopeId: string;
  startsAt: Date;
  expiresAt?: Date | null;
  status: string;
};

export type CoverageContext = {
  paperExamId: ReadonlyMap<string, string>;
  examGroupId: ReadonlyMap<string, string>;
};

export function isLifetimeActive(
  entitlement: CoverageEntitlement,
  now: Date,
): boolean {
  if (entitlement.status !== 'ACTIVE') {
    return false;
  }
  if (entitlement.startsAt.getTime() > now.getTime()) {
    return false;
  }
  return entitlement.expiresAt == null;
}

/**
 * True when every grant is covered for life by an active entitlement,
 * using the same scope hierarchy as paper access.
 */
export function coveredForLife(
  grants: CoverageGrant[],
  entitlements: CoverageEntitlement[],
  context: CoverageContext,
  now: Date,
): boolean {
  if (grants.length === 0) {
    return false;
  }
  const lifetime = entitlements.filter(row => isLifetimeActive(row, now));
  return grants.every(grant => grantCovered(grant, lifetime, context));
}

function grantCovered(
  grant: CoverageGrant,
  entitlements: CoverageEntitlement[],
  context: CoverageContext,
): boolean {
  return entitlements.some(entitlement =>
    coversGrant(entitlement, grant, context),
  );
}

function coversGrant(
  entitlement: CoverageEntitlement,
  grant: CoverageGrant,
  context: CoverageContext,
): boolean {
  if (
    entitlement.scopeType === grant.scopeType &&
    entitlement.scopeId === grant.scopeId
  ) {
    return true;
  }

  if (grant.scopeType === EntitlementScopeType.MOCK_TEST) {
    const examId = context.paperExamId.get(grant.scopeId);
    if (!examId) {
      return false;
    }
    if (
      entitlement.scopeType === EntitlementScopeType.EXAM &&
      entitlement.scopeId === examId
    ) {
      return true;
    }
    const groupId = context.examGroupId.get(examId);
    return (
      entitlement.scopeType === EntitlementScopeType.EXAM_GROUP &&
      !!groupId &&
      entitlement.scopeId === groupId
    );
  }

  if (grant.scopeType === EntitlementScopeType.EXAM) {
    const groupId = context.examGroupId.get(grant.scopeId);
    return (
      entitlement.scopeType === EntitlementScopeType.EXAM_GROUP &&
      !!groupId &&
      entitlement.scopeId === groupId
    );
  }

  return false;
}
