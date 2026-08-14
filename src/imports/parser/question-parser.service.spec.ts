import { QuestionParserService } from './question-parser.service';
import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';

describe('QuestionParserService', () => {
  const service = new QuestionParserService();

  const numberedBoundary: QuestionBoundaryStrategy = {
    isQuestionStart: (line: string) => /^\d+\./.test(line.trim()),
    parseQuestionStart: (line: string) => {
      const match = line.trim().match(/^(\d+)\.\s*(.*)$/);
      if (!match) {
        return null;
      }
      return { number: Number(match[1]), content: match[2] };
    },
  };

  it('parses numbered question blocks from markdown', () => {
    const markdown = `1. First stem\nmore of first\n2. Second stem`;

    const questions = service.parse(markdown, numberedBoundary);

    expect(questions).toEqual([
      { number: 1, content: 'First stem\nmore of first' },
      { number: 2, content: 'Second stem' },
    ]);
  });

  it('returns an empty array when no question starts are found', () => {
    expect(service.parse('just prose', numberedBoundary)).toEqual([]);
  });
});
