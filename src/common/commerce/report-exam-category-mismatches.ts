export type ExamCategoryMismatch = {
  examId: string;
  examName: string;
  examCategoryId: string;
  examGroupId: string;
  examGroupName: string;
  examGroupCategoryId: string;
};

export type ExamForMismatchReport = {
  _id: { toString(): string };
  name?: string;
  category?: { toString(): string } | null;
  examGroup?: { toString(): string } | null;
  isDeleted?: boolean;
};

export type ExamGroupForMismatchReport = {
  _id: { toString(): string };
  name?: string;
  category?: { toString(): string } | null;
};

function idOrEmpty(value: { toString(): string } | null | undefined): string {
  return value == null ? '' : value.toString();
}

/**
 * Finds non-deleted exams whose category does not match their exam group's category.
 * Also reports exams missing category/examGroup (legacy dirty data).
 * Does not mutate data — report only.
 */
export function findExamCategoryMismatches(
  exams: ExamForMismatchReport[],
  examGroups: ExamGroupForMismatchReport[],
): ExamCategoryMismatch[] {
  const groupById = new Map(
    examGroups.map(group => [group._id.toString(), group]),
  );

  const mismatches: ExamCategoryMismatch[] = [];

  for (const exam of exams) {
    if (exam.isDeleted === true) {
      continue;
    }

    const examCategoryId = idOrEmpty(exam.category);
    const groupId = idOrEmpty(exam.examGroup);

    if (!groupId) {
      mismatches.push({
        examId: exam._id.toString(),
        examName: exam.name || '',
        examCategoryId,
        examGroupId: '',
        examGroupName: '(exam missing examGroup)',
        examGroupCategoryId: '',
      });
      continue;
    }

    const group = groupById.get(groupId);
    if (!group) {
      mismatches.push({
        examId: exam._id.toString(),
        examName: exam.name || '',
        examCategoryId,
        examGroupId: groupId,
        examGroupName: '(missing exam group)',
        examGroupCategoryId: '',
      });
      continue;
    }

    const examGroupCategoryId = idOrEmpty(group.category);
    if (!examCategoryId || !examGroupCategoryId) {
      mismatches.push({
        examId: exam._id.toString(),
        examName: exam.name || '',
        examCategoryId,
        examGroupId: groupId,
        examGroupName: group.name || '',
        examGroupCategoryId,
      });
      continue;
    }

    if (examCategoryId !== examGroupCategoryId) {
      mismatches.push({
        examId: exam._id.toString(),
        examName: exam.name || '',
        examCategoryId,
        examGroupId: groupId,
        examGroupName: group.name || '',
        examGroupCategoryId,
      });
    }
  }

  return mismatches;
}
