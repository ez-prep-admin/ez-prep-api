import { AccessDecision } from './access-decision';

/** Student-facing access fragment (api-contracts §11 / phase 03). */
export type AccessDto = {
  allowed: boolean;
  reason: string;
};

export function toAccessDto(decision: AccessDecision): AccessDto {
  return {
    allowed: decision.allowed,
    reason: decision.reason,
  };
}
