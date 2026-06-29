import { MatchedQuestion } from '../../types/matched-question';
import { ParserConfiguration } from '../../types/parser-configuration';
import { ParserResult } from '../../types/parser-result';

export interface QuestionPaperParserStrategy {
  readonly configuration: ParserConfiguration;
  supports(markdown: string): boolean;
  parse(markdown: string): Promise<MatchedQuestion[]>;
  parseWithResult(markdown: string): Promise<ParserResult<MatchedQuestion[]>>;
}
