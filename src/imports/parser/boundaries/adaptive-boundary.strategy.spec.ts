import { AdaptiveBoundaryStrategy } from './adaptive-boundary.strategy';
import { DocumentStructure } from '../../types/document-structure';

describe('AdaptiveBoundaryStrategy', () => {
  const strategy = new AdaptiveBoundaryStrategy();

  const mathonGoStructure: DocumentStructure = {
    questionPattern: {
      type: 'numbered',
      regex: '^## Q\\d+\\.\\s',
      exampleMatch: '## Q1. JEE Main 2026 (21 January Shift 2)',
    },
    solutionPattern: {
      location: 'inline',
      matchesQuestionNumbering: false,
      inlineFormat: 'Ans:',
    },
    delimiter: {
      type: 'heading',
      value: '## Q',
      confidence: 1,
    },
    metadata: {
      hasDifficulty: false,
      hasMarks: false,
      hasSubjectLabels: true,
      examType: 'JEE Main',
    },
    detectedFormat: 'JEE Main with inline solutions',
    confidence: 0.95,
  };

  beforeEach(() => {
    strategy.initialize(mathonGoStructure);
  });

  it('detects MathonGo question headings without capture groups', () => {
    const line = '## Q1. JEE Main 2026 (21 January Shift 2)';

    expect(strategy.isQuestionStart(line)).toBe(true);
    expect(strategy.parseQuestionStart(line)).toEqual({
      number: 1,
      content: 'JEE Main 2026 (21 January Shift 2)',
    });
  });

  it('extracts higher question numbers from Q-prefixed headings', () => {
    const parsed = strategy.parseQuestionStart(
      '## Q9. JEE Main 2026 (28 January Shift 1)',
    );

    expect(parsed).toEqual({
      number: 9,
      content: 'JEE Main 2026 (28 January Shift 1)',
    });
  });

  it('uses capture groups when provided', () => {
    strategy.initialize({
      ...mathonGoStructure,
      questionPattern: {
        type: 'numbered',
        regex: '^(\\d+)\\.\\s(.*)$',
        exampleMatch: '1. Alpha particles question',
      },
    });

    expect(strategy.parseQuestionStart('1. Alpha particles question')).toEqual({
      number: 1,
      content: 'Alpha particles question',
    });
  });
});
