import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export const ELIGIBLE_DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

export function isTaggedToExam(
  exams: Array<{ toString(): string }> | undefined,
  examId: { toString(): string },
): boolean {
  const target = examId.toString();
  return (exams || []).some(id => id?.toString() === target);
}

export function assertDraftEditable(status: string): void {
  if (status !== 'REVIEW') {
    throw new BadRequestException({
      message: 'Draft is not editable',
      error: 'DRAFT_NOT_EDITABLE',
    });
  }
}

export function assertQuestionId(questionId: string): void {
  if (!Types.ObjectId.isValid(questionId)) {
    throw new BadRequestException({
      message: 'Invalid question ID',
      error: 'QUESTION_NOT_ELIGIBLE',
    });
  }
}

export function assertIncomingEligible<
  T extends { isActive?: boolean; difficultyLevel?: string },
>(incoming: T | null | undefined): asserts incoming is T {
  if (
    !incoming ||
    !incoming.isActive ||
    !incoming.difficultyLevel ||
    !(ELIGIBLE_DIFFICULTY_LEVELS as readonly string[]).includes(
      incoming.difficultyLevel,
    )
  ) {
    throw new BadRequestException({
      message: 'Question is not eligible',
      error: 'QUESTION_NOT_ELIGIBLE',
    });
  }
}

export function assertReplacementRules(params: {
  slotSubjectId: string;
  incomingSubjectId?: string;
  incomingQuestionId: string;
  draftExamId: { toString(): string };
  incomingExams?: Array<{ toString(): string }>;
  allowCrossSubject: boolean;
  questions: Array<{
    position: number;
    question?: { toString(): string };
  }>;
  position: number;
}): void {
  if (
    !params.allowCrossSubject &&
    params.incomingSubjectId !== params.slotSubjectId
  ) {
    throw new BadRequestException({
      message: 'Replacement question must belong to the same subject',
      error: 'SUBJECT_MISMATCH',
    });
  }

  if (!isTaggedToExam(params.incomingExams, params.draftExamId)) {
    throw new BadRequestException({
      message: 'Replacement question must be tagged to this exam',
      error: 'EXAM_MISMATCH',
    });
  }

  const existingSlot = params.questions.find(
    question =>
      question.position !== params.position &&
      question.question?.toString() === params.incomingQuestionId,
  );
  if (existingSlot) {
    throw new BadRequestException({
      message: `This question is already on the paper at position ${existingSlot.position + 1}`,
      error: 'DUPLICATE_QUESTION',
      details: {
        questionId: params.incomingQuestionId,
        existingPosition: existingSlot.position,
        attemptedPosition: params.position,
      },
    });
  }
}

export function duplicateQuestionSummary(
  questions: Array<{ question?: { toString(): string }; position?: number }>,
): Array<{
  questionId: string;
  positions: number[];
  displayPositions: number[];
}> {
  const positionsById = new Map<string, number[]>();
  questions.forEach((row, index) => {
    const id = row.question?.toString();
    if (!id) {
      return;
    }
    const positions = positionsById.get(id) || [];
    positions.push(row.position ?? index);
    positionsById.set(id, positions);
  });

  return [...positionsById.entries()]
    .filter(([, positions]) => positions.length > 1)
    .map(([questionId, positions]) => ({
      questionId,
      positions,
      displayPositions: positions.map(position => position + 1),
    }));
}
