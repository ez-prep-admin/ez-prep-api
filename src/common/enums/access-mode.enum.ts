/**
 * Paper access mode for commerce entitlements.
 * FREE = no entitlement required; ENTITLED = requires covering entitlement.
 * Schema default is FREE until phase 15 rollout flips content deliberately.
 */
export enum AccessMode {
  FREE = 'FREE',
  ENTITLED = 'ENTITLED',
}
