/**
 * Report exams whose category does not match their exam group's category.
 * Does not auto-fix — owner review required.
 *
 * Usage:
 *   npm run commerce:report-exam-category-mismatches
 *
 * Exit code 1 when any mismatch is found.
 * Requires MONGODB_URI (loads .env from repo root when present).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';
import {
  ExamForMismatchReport,
  ExamGroupForMismatchReport,
  findExamCategoryMismatches,
} from '../src/common/commerce/report-exam-category-mismatches';

config({ path: resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  try {
    const examsCol = mongoose.connection.collection('exams');
    const groupsCol = mongoose.connection.collection('examgroups');

    const [exams, examGroups] = await Promise.all([
      examsCol
        .find({ isDeleted: { $ne: true } })
        .project({ name: 1, category: 1, examGroup: 1, isDeleted: 1 })
        .toArray() as Promise<ExamForMismatchReport[]>,
      groupsCol
        .find({})
        .project({ name: 1, category: 1 })
        .toArray() as Promise<ExamGroupForMismatchReport[]>,
    ]);

    const mismatches = findExamCategoryMismatches(exams, examGroups);

    console.log(
      JSON.stringify(
        {
          scannedExams: exams.length,
          scannedExamGroups: examGroups.length,
          mismatchCount: mismatches.length,
          mismatches,
        },
        null,
        2,
      ),
    );

    if (mismatches.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
