import { QuestionPaperParserStrategy } from './question-paper-parser.strategy';
import { MatchedQuestion } from '../../types/matched-question';
import { ParserResult } from '../../types/parser-result';

class DummyStrategy implements QuestionPaperParserStrategy {
  readonly configuration = {
    parserName: 'dummy',
    markers: { solutionsHeader: '' },
  };

  supports(markdown: string): boolean {
    return markdown.length > 0;
  }

  async parse(markdown: string): Promise<MatchedQuestion[]> {
    return (await this.parseWithResult(markdown)).data;
  }

  async parseWithResult(
    markdown: string,
  ): Promise<ParserResult<MatchedQuestion[]>> {
    return {
      data: markdown
        ? [{ number: 1, question: markdown, solution: undefined }]
        : [],
      warnings: [],
      errors: [],
    };
  }
}

describe('QuestionPaperParserStrategy', () => {
  const strategy: QuestionPaperParserStrategy = new DummyStrategy();

  it('exposes configuration and parse APIs', async () => {
    expect(strategy.configuration.parserName).toBe('dummy');
    expect(strategy.supports('Q')).toBe(true);
    expect(await strategy.parse('Q')).toEqual([
      { number: 1, question: 'Q', solution: undefined },
    ]);
    const result = await strategy.parseWithResult('');
    expect(result.data).toEqual([]);
  });
});
