import { EntitlementScopeType } from '../enums/entitlement-scope-type.enum';
import {
  buildProductVersionSnapshot,
  grantsEqual,
} from './product-version-snapshot';

describe('buildProductVersionSnapshot', () => {
  it('normalizes grants and freezes at given time', () => {
    const frozenAt = new Date('2026-10-07T12:00:00.000Z');
    const snap = buildProductVersionSnapshot(
      {
        id: 'prod1',
        version: 2,
        code: 'SSC_CGL_COMPLETE',
        name: 'SSC CGL Complete',
        description: 'Full pack',
        grants: [
          {
            scopeType: EntitlementScopeType.EXAM_GROUP,
            scopeId: 'group1',
          },
        ],
      },
      frozenAt,
    );

    expect(snap).toEqual({
      productId: 'prod1',
      version: 2,
      code: 'SSC_CGL_COMPLETE',
      name: 'SSC CGL Complete',
      description: 'Full pack',
      grants: [
        {
          scopeType: EntitlementScopeType.EXAM_GROUP,
          scopeId: 'group1',
        },
      ],
      frozenAt,
    });
  });
});

describe('grantsEqual', () => {
  it('is order-insensitive', () => {
    expect(
      grantsEqual(
        [
          { scopeType: EntitlementScopeType.EXAM, scopeId: 'a' },
          { scopeType: EntitlementScopeType.EXAM_GROUP, scopeId: 'b' },
        ],
        [
          { scopeType: EntitlementScopeType.EXAM_GROUP, scopeId: 'b' },
          { scopeType: EntitlementScopeType.EXAM, scopeId: 'a' },
        ],
      ),
    ).toBe(true);
  });

  it('detects differences', () => {
    expect(
      grantsEqual(
        [{ scopeType: EntitlementScopeType.EXAM, scopeId: 'a' }],
        [{ scopeType: EntitlementScopeType.EXAM, scopeId: 'b' }],
      ),
    ).toBe(false);
  });
});
