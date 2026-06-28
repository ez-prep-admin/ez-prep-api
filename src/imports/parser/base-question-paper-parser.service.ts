import { QuestionMatcherService } from './question-matcher.service';
import { MarkdownParserService } from './markdown-parser.service';
import { QuestionParserService } from './question-parser.service';
import { MatchedQuestion } from '../types/matched-question';
import { SolutionParserService } from './solution-parser.service';
import { ParserConfiguration } from '../types/parser-configuration';
import { QuestionPaperParserStrategy } from './strategies/question-paper-parser.strategy';
import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';
import { ParserResult } from '../types/parser-result';

export abstract class BaseQuestionPaperParser
  implements QuestionPaperParserStrategy
{
  abstract readonly configuration: ParserConfiguration;

  constructor(
    protected readonly markdownParser: MarkdownParserService,
    protected readonly questionParser: QuestionParserService,
    protected readonly solutionParser: SolutionParserService,
    protected readonly matcher: QuestionMatcherService,
  ) {}

  abstract supports(markdown: string): boolean;
  abstract getBoundaryStrategy(): QuestionBoundaryStrategy;

  async parse(markdown: string): Promise<MatchedQuestion[]> {
    return (await this.parseWithResult(markdown)).data;
  }

  async parseWithResult(
    markdown: string,
  ): Promise<ParserResult<MatchedQuestion[]>> {
    const document = this.markdownParser.parse(
      markdown,
      this.configuration.markers,
    );
    const boundary = this.getBoundaryStrategy();

    const questions = this.questionParser.parse(
      document.questionsSection,
      boundary,
    );
    const solutions = this.solutionParser.parse(
      document.solutionsSection,
      boundary,
    );
    const { matched, warnings } = this.matcher.matchWithWarnings(
      questions,
      solutions,
    );

    return {
      data: matched,
      warnings,
      errors: [],
    };
  }
}
