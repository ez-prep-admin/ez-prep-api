import { BaseQuestionPaperParser } from './base-question-paper-parser.service';
import { MarkdownParserService } from './markdown-parser.service';
import { QuestionParserService } from './question-parser.service';
import { SolutionParserService } from './solution-parser.service';
import { QuestionMatcherService } from './question-matcher.service';
import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';
import { ParserConfiguration } from '../types/parser-configuration';

class TestPaperParser extends BaseQuestionPaperParser {
  readonly configuration: ParserConfiguration = {
    parserName: 'test-paper',
    markers: { solutionsHeader: '## SOLUTIONS' },
  };

  supports(markdown: string): boolean {
    return markdown.includes('## SOLUTIONS');
  }

  getBoundaryStrategy(): QuestionBoundaryStrategy {
    return {
      isQuestionStart: (line: string) => /^\d+\./.test(line.trim()),
      parseQuestionStart: (line: string) => {
        const match = line.trim().match(/^(\d+)\.\s*(.*)$/);
        return match
          ? { number: Number(match[1]), content: match[2] }
          : null;
      },
    };
  }
}

describe('BaseQuestionPaperParser', () => {
  const parser = new TestPaperParser(
    new MarkdownParserService(),
    new QuestionParserService(),
    new SolutionParserService(),
    new QuestionMatcherService(),
  );

  const markdown = `1. Stem one\n\n2. Stem two\n\n## SOLUTIONS\n\n1. Ans one\n\n2. Ans two`;

  it('supports documents that include the configured solutions header', () => {
    expect(parser.supports(markdown)).toBe(true);
    expect(parser.supports('no header')).toBe(false);
  });

  it('parseWithResult returns matched questions and matcher warnings', async () => {
    const result = await parser.parseWithResult(markdown);

    expect(result.errors).toEqual([]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      number: 1,
      question: 'Stem one',
      solution: 'Ans one',
    });
  });

  it('parse returns only matched question data', async () => {
    const data = await parser.parse(markdown);

    expect(data.map(q => q.number)).toEqual([1, 2]);
  });
});
