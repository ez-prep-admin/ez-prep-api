import { SolutionParserService } from './solution-parser.service';
import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';

describe('SolutionParserService', () => {
  const service = new SolutionParserService();

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

  it('parses numbered solution blocks', () => {
    const markdown = `1. (a)\n2. (b) because energy is conserved`;

    const solutions = service.parse(markdown, numberedBoundary);

    expect(solutions).toHaveLength(2);
    expect(solutions[0]).toEqual({ number: 1, content: '(a)' });
    expect(solutions[1].number).toBe(2);
  });
});
