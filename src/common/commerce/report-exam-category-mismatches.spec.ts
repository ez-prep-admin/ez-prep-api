import { findExamCategoryMismatches } from './report-exam-category-mismatches';

describe('findExamCategoryMismatches', () => {
  const categoryA = '507f1f77bcf86cd799439011';
  const categoryB = '507f1f77bcf86cd799439099';
  const groupId = '507f1f77bcf86cd799439012';
  const examId = '507f1f77bcf86cd799439013';

  it('returns empty when categories match', () => {
    const mismatches = findExamCategoryMismatches(
      [
        {
          _id: { toString: () => examId },
          name: 'SBI PO',
          category: { toString: () => categoryA },
          examGroup: { toString: () => groupId },
        },
      ],
      [
        {
          _id: { toString: () => groupId },
          name: 'Banking Group',
          category: { toString: () => categoryA },
        },
      ],
    );
    expect(mismatches).toEqual([]);
  });

  it('lists mismatches without mutating', () => {
    const mismatches = findExamCategoryMismatches(
      [
        {
          _id: { toString: () => examId },
          name: 'SBI PO',
          category: { toString: () => categoryA },
          examGroup: { toString: () => groupId },
        },
      ],
      [
        {
          _id: { toString: () => groupId },
          name: 'Banking Group',
          category: { toString: () => categoryB },
        },
      ],
    );
    expect(mismatches).toEqual([
      {
        examId,
        examName: 'SBI PO',
        examCategoryId: categoryA,
        examGroupId: groupId,
        examGroupName: 'Banking Group',
        examGroupCategoryId: categoryB,
      },
    ]);
  });

  it('skips soft-deleted exams', () => {
    const mismatches = findExamCategoryMismatches(
      [
        {
          _id: { toString: () => examId },
          name: 'Deleted',
          category: { toString: () => categoryA },
          examGroup: { toString: () => groupId },
          isDeleted: true,
        },
      ],
      [
        {
          _id: { toString: () => groupId },
          name: 'Banking Group',
          category: { toString: () => categoryB },
        },
      ],
    );
    expect(mismatches).toEqual([]);
  });

  it('reports exams missing examGroup without crashing', () => {
    const mismatches = findExamCategoryMismatches(
      [
        {
          _id: { toString: () => examId },
          name: 'Legacy exam',
          category: { toString: () => categoryA },
          examGroup: null,
        },
      ],
      [],
    );
    expect(mismatches).toEqual([
      {
        examId,
        examName: 'Legacy exam',
        examCategoryId: categoryA,
        examGroupId: '',
        examGroupName: '(exam missing examGroup)',
        examGroupCategoryId: '',
      },
    ]);
  });
});
