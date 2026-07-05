export interface MatchedQuestion {
  /** Stable 0-based position in the parsed question list (unique per upload). */
  index?: number;
  number: number;
  question: string;
  solution?: string;
}
