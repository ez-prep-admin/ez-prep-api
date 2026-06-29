export interface ParsedQuestionStart {
  number: number;
  content: string;
}

export interface QuestionBoundaryStrategy {
  isQuestionStart(line: string): boolean;
  parseQuestionStart(line: string): ParsedQuestionStart | null;
}
