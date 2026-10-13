/**
 * Runtime access enforcement flag (D-16).
 * LEGACY allows ENTITLED papers without a matching entitlement (rollback).
 * ENFORCED denies without FREE or a covering entitlement.
 */
export enum AccessEnforcementMode {
  LEGACY = 'LEGACY',
  ENFORCED = 'ENFORCED',
}
