import { ParserWarning, ParserError } from '../types/parser-result';
import { MatchedQuestion } from '../types/matched-question';

export class ParseMarkdownResponseDto {
  uploadId: string;
  parserName: string;
  matchedQuestions: MatchedQuestion[];
  warnings: ParserWarning[];
  errors?: ParserError[];
  stats: {
    questionCount: number;
    solutionCount: number;
    matchedCount: number;
  };
  chunkingPreview: {
    estimatedChunks: number;
    totalTokens: number;
    avgQuestionsPerChunk: number;
    avgTokensPerChunk: number;
    chunks?: Array<{
      chunkIndex: number;
      questionCount: number;
      estimatedTokens: number;
      questionNumbers: number[];
    }>;
  };
}
