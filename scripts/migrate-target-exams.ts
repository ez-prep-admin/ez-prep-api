/**
 * Copy a legacy single targetExam into targetExams when the list is still empty.
 *
 *   npm run users:migrate-target-exams
 *   npm run users:migrate-target-exams -- --apply
 *
 * Dry run is the default. It prints how many learners would change and does not write.
 */
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const FILTER = {
  targetExam: { $type: 'objectId' },
  $or: [
    { targetExams: { $exists: false } },
    { targetExams: null },
    { targetExams: { $size: 0 } },
  ],
};

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  try {
    const databaseName = mongoose.connection.db?.databaseName;
    if (!databaseName) {
      throw new Error('Could not read the database name from MONGODB_URI');
    }

    const users = mongoose.connection.collection('users');
    const matched = await users.countDocuments(FILTER);
    let modified = 0;
    if (apply && matched > 0) {
      const result = await users.updateMany(FILTER, [
        { $set: { targetExams: ['$targetExam'] } },
      ]);
      modified = result.modifiedCount;
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          database: databaseName,
          matched,
          modified,
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
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
