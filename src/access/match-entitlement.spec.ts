import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { entitlementCoversPaper } from './match-entitlement';

const MOCK_ID = '507f1f77bcf86cd799439021';
const EXAM_ID = '507f1f77bcf86cd799439022';
const GROUP_ID = '507f1f77bcf86cd799439023';

describe('entitlementCoversPaper', () => {
  it('matches MOCK_TEST scope', () => {
    expect(
      entitlementCoversPaper(
        [{ scopeType: EntitlementScopeType.MOCK_TEST, scopeId: MOCK_ID }],
        MOCK_ID,
        EXAM_ID,
        GROUP_ID,
      ),
    ).toBe(true);
  });

  it('matches EXAM scope', () => {
    expect(
      entitlementCoversPaper(
        [{ scopeType: EntitlementScopeType.EXAM, scopeId: EXAM_ID }],
        MOCK_ID,
        EXAM_ID,
        GROUP_ID,
      ),
    ).toBe(true);
  });

  it('matches EXAM_GROUP scope', () => {
    expect(
      entitlementCoversPaper(
        [{ scopeType: EntitlementScopeType.EXAM_GROUP, scopeId: GROUP_ID }],
        MOCK_ID,
        EXAM_ID,
        GROUP_ID,
      ),
    ).toBe(true);
  });

  it('rejects unrelated entitlement', () => {
    expect(
      entitlementCoversPaper(
        [
          {
            scopeType: EntitlementScopeType.EXAM,
            scopeId: '507f1f77bcf86cd799439099',
          },
        ],
        MOCK_ID,
        EXAM_ID,
        GROUP_ID,
      ),
    ).toBe(false);
  });

  it('returns false for empty entitlements', () => {
    expect(entitlementCoversPaper([], MOCK_ID, EXAM_ID, GROUP_ID)).toBe(false);
  });
});
