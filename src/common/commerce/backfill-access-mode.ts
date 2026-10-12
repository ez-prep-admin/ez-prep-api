import { AccessMode } from '../enums/access-mode.enum';

export type AccessModeBackfillCollection = {
  updateMany: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ) => Promise<{ matchedCount: number; modifiedCount: number }>;
};

export type AccessModeBackfillResult = {
  matchedCount: number;
  modifiedCount: number;
};

/**
 * Idempotent FREE backfill for mocktests.
 * Matches docs missing accessMode or set to anything other than FREE.
 */
export async function backfillMockTestAccessModeFree(
  collection: AccessModeBackfillCollection,
): Promise<AccessModeBackfillResult> {
  const result = await collection.updateMany(
    {
      $or: [
        { accessMode: { $exists: false } },
        { accessMode: null },
        { accessMode: { $ne: AccessMode.FREE } },
      ],
    },
    { $set: { accessMode: AccessMode.FREE } },
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
}
