/**
 * Runtime access enforcement flag (D-16).
 * LEGACY allows ENTITLED papers without a matching entitlement (migration safety).
 * ENFORCED denies without FREE or a covering entitlement.
 * Default until phase 15: LEGACY.
 */
export enum AccessEnforcementMode {
  LEGACY = 'LEGACY',
  ENFORCED = 'ENFORCED',
}
