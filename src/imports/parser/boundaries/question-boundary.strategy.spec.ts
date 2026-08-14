import {
  ParsedQuestionStart,
  QuestionBoundaryStrategy,
} from './question-boundary.strategy';

class PrefixBoundary implements QuestionBoundaryStrategy {
  isQuestionStart(line: string): boolean {
    return this.parseQuestionStart(line) !== null;
  }

  parseQuestionStart(line: string): ParsedQuestionStart | null {
    const match = line.match(/^Q(\d+)\.\s*(.*)$/);
    if (!match) {
      return null;
    }
    return { number: Number(match[1]), content: match[2] };
  }
}

describe('QuestionBoundaryStrategy', () => {
  const strategy: QuestionBoundaryStrategy = new PrefixBoundary();

  it('detects and parses question start lines', () => {
    expect(strategy.isQuestionStart('Q12. Stem')).toBe(true);
    expect(strategy.parseQuestionStart('Q12. Stem')).toEqual({
      number: 12,
      content: 'Stem',
    });
    expect(strategy.parseQuestionStart('not a start')).toBeNull();
  });
});
