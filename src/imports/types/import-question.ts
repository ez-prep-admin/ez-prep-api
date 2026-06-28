import { DifficultyLevel } from '../config/business-validator.config';
import { ImportImageMetadata } from './import-image-metadata';

export interface ImportQuestionOption {
  id: string;
  type: 'text';
  en: string;
  ml: null;
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
  optionType: 'text';
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
}

export interface EnrichQuestionResult {
  number: number;
  question: ImportQuestion;
}

export interface EnrichError {
  number: number;
  stage: 'llm' | 'zod' | 'business' | 'mapping';
  message: string;
}

export interface EnrichDebugResult {
  questions: ImportQuestion[];
  results: EnrichQuestionResult[];
  errors: EnrichError[];
  stats: {
    total: number;
    success: number;
    failed: number;
  };
}
