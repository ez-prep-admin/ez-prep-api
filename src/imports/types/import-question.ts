import { DifficultyLevel } from '../config/business-validator.config';
import { QuestionSource } from '../../mock-test-attempts/schemas/question.schema';
import { ImportImageMetadata } from './import-image-metadata';
import { MatchedQuestion } from './matched-question';

export const PDF_IMPORT_QUESTION_SOURCE =
  'PDF_UPLOAD' as const satisfies QuestionSource;

export interface ImportQuestionOption {
  id: string;
  type: 'text' | 'image';
  en: string | null;
  ml: null;
  image?: ImportImageMetadata | null;
}

export interface ImportQuestionTextLanguage {
  text?: string | null;
  image?: ImportImageMetadata | null;
}

export interface ImportQuestion {
  questionText: {
    en: ImportQuestionTextLanguage;
    ml: { text: null; image: null };
  };
  optionType: 'text' | 'image';
  options: ImportQuestionOption[];
  explanation: {
    en: string;
    ml: null;
    image: ImportImageMetadata | null;
  };
  correctAnswer: string;
  subject: string;
  topic: string;
  exams: string[];
  difficultyLevel: DifficultyLevel;
  isActive: boolean;
  isDeleted: boolean;
  source: typeof PDF_IMPORT_QUESTION_SOURCE;
}

/** Payload shape before persist validation; source is applied by Zod default. */
export type ImportQuestionInput = Omit<ImportQuestion, 'source'> & {
  source?: typeof PDF_IMPORT_QUESTION_SOURCE;
};

export interface PersistQuestionError {
  index: number;
  message: string;
}

export interface PersistedQuestionRef {
  index: number;
  questionId: string;
}

export interface PersistQuestionsResult {
  saved: PersistedQuestionRef[];
  errors: PersistQuestionError[];
  stats: {
    total: number;
    saved: number;
    failed: number;
  };
}

export interface EnrichError {
  /** Stable parse index; used to dedupe failures vs successes across chunks. */
  index?: number;
  number: number;
  stage: 'llm' | 'zod' | 'business' | 'mapping' | 'image';
  message: string;
  matchedQuestion?: MatchedQuestion;
  questionDraft?: ImportQuestion;
}

export interface RejectedQuestion extends EnrichError {
  matchedQuestion: MatchedQuestion;
}

export interface EnrichDebugResult {
  questions: ImportQuestion[];
  rejected: RejectedQuestion[];
  stats: {
    total: number;
    success: number;
    failed: number;
    durationMs?: number;
  };
  summary: string;
  chunking?: {
    adaptiveChunking: boolean;
    chunkCount: number;
    totalTokens: number;
    chunks: Array<{
      chunkIndex: number;
      questionCount: number;
      estimatedTokens: number;
      questionNumbers: number[];
    }>;
  };
  parse?: {
    fromCache: boolean;
    parserName: string;
    matchedCount: number;
  };
  uploadId?: string;
  status?: string;
}
