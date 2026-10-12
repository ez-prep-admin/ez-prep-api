import { AccessMode } from '../enums/access-mode.enum';
import {
  AccessModeBackfillCollection,
  backfillMockTestAccessModeFree,
} from './backfill-access-mode';

describe('backfillMockTestAccessModeFree', () => {
  it('sets missing accessMode docs to FREE and reports counts', async () => {
    const collection: AccessModeBackfillCollection = {
      updateMany: jest.fn().mockResolvedValue({
        matchedCount: 3,
        modifiedCount: 3,
      }),
    };

    const result = await backfillMockTestAccessModeFree(collection);

    expect(collection.updateMany).toHaveBeenCalledWith(
      {
        $or: [
          { accessMode: { $exists: false } },
          { accessMode: null },
          { accessMode: { $ne: AccessMode.FREE } },
        ],
      },
      { $set: { accessMode: AccessMode.FREE } },
    );
    expect(result).toEqual({ matchedCount: 3, modifiedCount: 3 });
  });

  it('leaves already-FREE docs unchanged (modifiedCount 0)', async () => {
    const collection: AccessModeBackfillCollection = {
      updateMany: jest.fn().mockResolvedValue({
        matchedCount: 0,
        modifiedCount: 0,
      }),
    };

    const result = await backfillMockTestAccessModeFree(collection);
    expect(result.matchedCount).toBe(0);
    expect(result.modifiedCount).toBe(0);
  });
});
