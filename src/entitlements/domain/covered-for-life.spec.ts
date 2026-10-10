import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';
import { coveredForLife } from './covered-for-life';

describe('coveredForLife', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');
  const paper = 'paper-1';
  const exam = 'exam-1';
  const group = 'group-1';
  const context = {
    paperExamId: new Map([[paper, exam]]),
    examGroupId: new Map([[exam, group]]),
  };

  function lifetime(scopeType: string, scopeId: string) {
    return {
      scopeType,
      scopeId,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: null,
      status: 'ACTIVE',
    };
  }

  it('treats an exam entitlement as covering that exam paper grant', () => {
    expect(
      coveredForLife(
        [{ scopeType: EntitlementScopeType.MOCK_TEST, scopeId: paper }],
        [lifetime(EntitlementScopeType.EXAM, exam)],
        context,
        now,
      ),
    ).toBe(true);
  });

  it('does not treat a paper entitlement as covering the exam', () => {
    expect(
      coveredForLife(
        [{ scopeType: EntitlementScopeType.EXAM, scopeId: exam }],
        [lifetime(EntitlementScopeType.MOCK_TEST, paper)],
        context,
        now,
      ),
    ).toBe(false);
  });

  it('counts an admin lifetime grant', () => {
    expect(
      coveredForLife(
        [{ scopeType: EntitlementScopeType.EXAM, scopeId: exam }],
        [lifetime(EntitlementScopeType.EXAM, exam)],
        context,
        now,
      ),
    ).toBe(true);
  });

  it('allows purchase when a grant is not covered for life', () => {
    expect(
      coveredForLife(
        [
          { scopeType: EntitlementScopeType.EXAM, scopeId: exam },
          { scopeType: EntitlementScopeType.EXAM, scopeId: 'exam-2' },
        ],
        [lifetime(EntitlementScopeType.EXAM, exam)],
        context,
        now,
      ),
    ).toBe(false);
  });
});
