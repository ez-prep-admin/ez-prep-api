import { AccessDecisionReason } from '../common/enums/access-decision-reason.enum';
import { AccessMode } from '../common/enums/access-mode.enum';
import { toAccessDto } from './to-access-dto';

describe('toAccessDto', () => {
  it('maps allowed + reason and drops accessMode', () => {
    expect(
      toAccessDto({
        allowed: false,
        reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
        accessMode: AccessMode.ENTITLED,
      }),
    ).toEqual({
      allowed: false,
      reason: AccessDecisionReason.ENTITLEMENT_REQUIRED,
    });
  });
});
