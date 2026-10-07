import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';

export type EntitlementMatchInput = {
  scopeType: EntitlementScopeType | string;
  scopeId: { toString(): string } | string;
};

/**
 * Pure grant hierarchy match (access-control.md §2).
 * Any one matching active entitlement is sufficient.
 */
export function entitlementCoversPaper(
  entitlements: EntitlementMatchInput[],
  mockTestId: string,
  examId: string,
  examGroupId: string,
): boolean {
  return entitlements.some(entitlement => {
    const scopeId = String(entitlement.scopeId);
    if (
      entitlement.scopeType === EntitlementScopeType.MOCK_TEST &&
      scopeId === mockTestId
    ) {
      return true;
    }
    if (
      entitlement.scopeType === EntitlementScopeType.EXAM &&
      scopeId === examId
    ) {
      return true;
    }
    if (
      entitlement.scopeType === EntitlementScopeType.EXAM_GROUP &&
      scopeId === examGroupId
    ) {
      return true;
    }
    return false;
  });
}
