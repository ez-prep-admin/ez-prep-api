/**
 * Idempotent removal of the unused users.subscription field.
 *
 * Usage:
 *   npm run users:unset-subscription
 *
 * Requires MONGODB_URI (loads .env from repo root when present).
 * Does not run on application startup.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';

config({ path: resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection('users');
    const result = await collection.updateMany(
      { subscription: { $exists: true } },
      { $unset: { subscription: '' } },
    );

    console.log(
      JSON.stringify(
        {
          collection: 'users',
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          message: 'Unset users.subscription where the field still exists.',
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
