import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FLIP_TEST_IMPORT_METADATA } from '../config/import-metadata.config';
import { AiQuestionOutput } from '../types/ai-question-output';
import {
  ImportQuestion,
  PDF_IMPORT_QUESTION_SOURCE,
} from '../types/import-question';
import { MatchedQuestion } from '../types/matched-question';
import { MarkdownImageExtractorService } from './markdown-image.extractor';

export interface QuestionMapperMetadata {
  subjectId: string;
  topicId: string;
  examIds: readonly string[];
}

@Injectable()
export class QuestionMapper {
  constructor(
    private readonly markdownImageExtractor: MarkdownImageExtractorService,
  ) {}

  map(
    output: AiQuestionOutput,
    metadata: QuestionMapperMetadata = FLIP_TEST_IMPORT_METADATA,
    source?: MatchedQuestion,
  ): ImportQuestion {
    const optionIds = new Map<string, string>();

    const options = output.options.map(option => {
      const id = randomUUID();
      optionIds.set(option.label, id);

      return {
        id,
        type: 'text' as const,
        en: option.text,
        ml: null,
      };
    });

    const correctAnswer = optionIds.get(output.correctAnswer);

    if (!correctAnswer) {
      throw new Error(
        `Unable to map correct answer label "${output.correctAnswer}" to an option id.`,
      );
    }

    const questionContent = this.markdownImageExtractor.buildQuestionContent(
      output.questionText,
      source?.question,
    );

    const explanationContent = this.markdownImageExtractor.extractFromText(
      output.explanation,
    );

    return {
      questionText: {
        en: {
          text: questionContent.text,
          image: questionContent.image,
        },
        ml: { text: null, image: null },
      },
      optionType: 'text',
      options,
      explanation: {
        en: explanationContent.text,
        ml: null,
        image: explanationContent.image,
      },
      correctAnswer,
      subject: metadata.subjectId,
      topic: metadata.topicId,
      exams: [...metadata.examIds],
      difficultyLevel: output.difficultyLevel,
      isActive: true,
      isDeleted: false,
      source: PDF_IMPORT_QUESTION_SOURCE,
    };
  }
}
