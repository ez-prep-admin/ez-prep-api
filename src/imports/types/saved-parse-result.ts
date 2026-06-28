import { MatchedQuestion } from './matched-question';
import { ParserWarning } from './parser-result';

export interface SavedParseResult {
  parserName: string;
  document: {
    questionsSection: string;
    solutionsSection: string;
  };
  matchedQuestions: MatchedQuestion[];
  warnings: ParserWarning[];
  stats: {
    questionCount: number;
    solutionCount: number;
    matchedCount: number;
  };
  savedAt: string;
}
