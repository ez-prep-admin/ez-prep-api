import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiQuestionOutput } from '../types/ai-question-output';
import {
  ImportQuestion,
  ImportQuestionOption,
  PDF_IMPORT_QUESTION_SOURCE,
} from '../types/import-question';
import { MatchedQuestion } from '../types/matched-question';
import { MarkdownImageExtractorService } from './markdown-image.extractor';
import { preferMathFaithfulText } from '../utils/latex-fidelity.util';
import { splitPrimaryAndExtraImages } from '../types/import-image-metadata';

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
    metadata: QuestionMapperMetadata,
    source?: MatchedQuestion,
  ): ImportQuestion {
    const optionIds = new Map<string, string>();

    const options: ImportQuestionOption[] = output.options.map(option => {
      const id = randomUUID();
      optionIds.set(option.label, id);

      const sourceOption = source?.question
        ? this.markdownImageExtractor.extractOptionContent(
            source.question,
            option.label,
          )
        : null;

      const optionImage = sourceOption?.image ?? null;
      const optionText =
        preferMathFaithfulText(option.text, sourceOption?.text ?? '') ||
        option.text ||
        sourceOption?.text ||
        '';

      if (optionImage) {
        return {
          id,
          type: 'image' as const,
          en: optionText || null,
          ml: null,
          image: optionImage,
        };
      }

      return {
        id,
        type: 'text' as const,
        en: optionText,
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

    const stemImageUrls = new Set(
      questionContent.images.map(image => image.url).filter(Boolean),
    );
    if (stemImageUrls.size > 0) {
      for (let index = 0; index < options.length; index++) {
        const option = options[index];
        if (
          option.type === 'image' &&
          option.image?.url &&
          stemImageUrls.has(option.image.url)
        ) {
          options[index] = {
            id: option.id,
            type: 'text',
            en: option.en || '',
            ml: null,
          };
        }
      }
    }

    const explanationContent =
      this.markdownImageExtractor.buildExplanationContent(
        output.explanation,
        source?.solution,
      );

    const hasImageOption = options.some(option => option.type === 'image');
    // Stem keeps a single primary image (existing behavior). Multi-image
    // extras (`images[]`) are solution/explanation only.
    const explanationImages = splitPrimaryAndExtraImages(
      explanationContent.images,
    );

    return {
      questionText: {
        en: {
          text: questionContent.text,
          image: questionContent.image,
        },
        ml: { text: null, image: null },
      },
      optionType: hasImageOption ? 'image' : 'text',
      options,
      explanation: {
        en: explanationContent.text,
        ml: null,
        image: explanationImages.image,
        ...(explanationImages.images.length
          ? { images: explanationImages.images }
          : {}),
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
