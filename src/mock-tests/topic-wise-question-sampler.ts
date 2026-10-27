import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { QuestionDocument } from '../mock-test-attempts/schemas/question.schema';

export interface TopicWiseSampleInput {
  exam: string;
  subject: string;
  topic?: string;
  difficultyDistribution: { easy: number; medium: number; hard: number };
}

export interface SampledTopicWiseQuestion {
  _id: Types.ObjectId;
  subject?: Types.ObjectId;
  topic?: Types.ObjectId;
  difficultyLevel: 'easy' | 'medium' | 'hard';
}

/**
 * Samples a topic-wise paper: exam-tagged, subject (and optional topic),
 * active, not deleted, one random bucket per difficulty, easy then medium then hard.
 */
export async function sampleTopicWiseQuestionIds(
  questionModel: Model<QuestionDocument>,
  input: TopicWiseSampleInput,
): Promise<SampledTopicWiseQuestion[]> {
  const baseMatch: Record<string, unknown> = {
    subject: new Types.ObjectId(input.subject),
    exams: new Types.ObjectId(input.exam),
    isActive: true,
    isDeleted: { $ne: true },
  };
  if (input.topic) {
    baseMatch.topic = new Types.ObjectId(input.topic);
  }

  const levels = (['easy', 'medium', 'hard'] as const).filter(
    level => input.difficultyDistribution[level] > 0,
  );

  const sampledGroups = await Promise.all(
    levels.map(async level => {
      const count = input.difficultyDistribution[level];
      const questions = await questionModel.aggregate([
        { $match: { ...baseMatch, difficultyLevel: level } },
        { $sample: { size: count } },
      ]);

      if (questions.length < count) {
        throw new BadRequestException(
          `Not enough ${level} questions available. Found ${questions.length}, need ${count}`,
        );
      }

      return questions.map(question => ({
        _id: question._id as Types.ObjectId,
        subject: question.subject as Types.ObjectId | undefined,
        topic: question.topic as Types.ObjectId | undefined,
        difficultyLevel: level,
      }));
    }),
  );

  return sampledGroups.flat();
}
