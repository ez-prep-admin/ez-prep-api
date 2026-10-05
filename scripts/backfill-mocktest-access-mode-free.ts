/**
 * Idempotent FREE backfill for mocktests.accessMode.
 *
 * Usage:
 *   npm run commerce:backfill-access-mode-free
 *
 * Requires MONGODB_URI (loads .env from repo root when present).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { backfillMockTestAccessModeFree } from '../src/common/commerce/backfill-access-mode';

config({ path: resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection('mocktests');
    const result = await backfillMockTestAccessModeFree({
      updateMany: async (filter, update) => {
        const raw = await collection.updateMany(filter, update);
        return {
          matchedCount: raw.matchedCount,
          modifiedCount: raw.modifiedCount,
        };
      },
    });

    console.log(
      JSON.stringify(
        {
          collection: 'mocktests',
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          message:
            'Set accessMode=FREE where missing or not FREE (idempotent).',
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
