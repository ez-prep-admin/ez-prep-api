import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveParserStrategy } from './adaptive-parser.strategy';
import { MarkdownParserService } from '../markdown-parser.service';
import { QuestionParserService } from '../question-parser.service';
import { SolutionParserService } from '../solution-parser.service';
import { QuestionMatcherService } from '../question-matcher.service';
import { AdaptiveBoundaryStrategy } from '../boundaries/adaptive-boundary.strategy';
import { StructureDetectorService } from '../structure-detector.service';
import { DocumentStructure } from '../../types/document-structure';

const numberedStructure: DocumentStructure = {
  questionPattern: {
    type: 'numbered',
    regex: '^(\\d+)\\.\\s(.*)$',
    exampleMatch: '1. Stem',
  },
  solutionPattern: {
    location: 'separate',
    marker: '## SOLUTIONS',
    matchesQuestionNumbering: true,
  },
  delimiter: { type: 'heading', value: '##', confidence: 0.9 },
  metadata: {
    hasDifficulty: false,
    hasMarks: false,
    hasSubjectLabels: false,
  },
  detectedFormat: 'numbered with solutions section',
  confidence: 0.9,
};

describe('AdaptiveParserStrategy', () => {
  let strategy: AdaptiveParserStrategy;
  const detectStructure = jest.fn();

  beforeEach(async () => {
    detectStructure.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdaptiveParserStrategy,
        MarkdownParserService,
        QuestionParserService,
        SolutionParserService,
        QuestionMatcherService,
        AdaptiveBoundaryStrategy,
        {
          provide: StructureDetectorService,
          useValue: { detectStructure },
        },
      ],
    }).compile();

    strategy = module.get(AdaptiveParserStrategy);
  });

  it('supports any markdown', () => {
    expect(strategy.supports('')).toBe(true);
  });

  it('throws if getBoundaryStrategy is used before parse', () => {
    expect(() => strategy.getBoundaryStrategy()).toThrow(/not initialized/);
  });

  it('parses a document using detected structure', async () => {
    detectStructure.mockResolvedValue(numberedStructure);
    const markdown = `1. First\n\n2. Second\n\n## SOLUTIONS\n\n1. A\n\n2. B`;

    const result = await strategy.parseWithResult(markdown);

    expect(result.errors).toEqual([]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].solution).toBe('A');
    expect(strategy.configuration.parserName).toBe('adaptive');
    expect(strategy.getCachedStructure()?.detectedFormat).toContain('numbered');
  });

  it('uses seeded structure and skips detection', async () => {
    strategy.seedStructure(numberedStructure);
    const markdown = `1. First\n\n## SOLUTIONS\n\n1. A`;

    const result = await strategy.parseWithResult(markdown);

    expect(detectStructure).not.toHaveBeenCalled();
    expect(result.data[0].number).toBe(1);
  });

  it('re-detects when a seeded structure matches zero questions', async () => {
    strategy.seedStructure({
      ...numberedStructure,
      questionPattern: {
        type: 'labeled',
        regex: '^NOMATCH',
        exampleMatch: 'x',
      },
    });
    detectStructure.mockResolvedValue(numberedStructure);

    const result = await strategy.parseWithResult(
      `1. First\n\n## SOLUTIONS\n\n1. A`,
    );

    expect(detectStructure).toHaveBeenCalled();
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('adds a low-confidence warning', async () => {
    detectStructure.mockResolvedValue({
      ...numberedStructure,
      confidence: 0.4,
      warnings: ['odd layout'],
    });

    const result = await strategy.parseWithResult(
      `1. First\n\n## SOLUTIONS\n\n1. A`,
    );

    expect(result.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
    expect(result.warnings.some(w => w.message.includes('odd layout'))).toBe(
      true,
    );
  });

  it('returns a parse error instead of throwing when detection fails', async () => {
    detectStructure.mockRejectedValue(new Error('LLM down'));

    const result = await strategy.parseWithResult('1. Q');

    expect(result.data).toEqual([]);
    expect(result.errors[0].code).toBe('ADAPTIVE_PARSE_FAILED');
  });

  it('clears cached structure', () => {
    strategy.seedStructure(numberedStructure);
    strategy.clearCache();
    expect(strategy.getCachedStructure()).toBeNull();
  });

  it('parse delegates to parseWithResult', async () => {
    detectStructure.mockResolvedValue(numberedStructure);
    const data = await strategy.parse(`1. First\n\n## SOLUTIONS\n\n1. A`);
    expect(data[0].question).toContain('First');
  });

  it('splits repeated numbering when there is no solutions section', async () => {
    detectStructure.mockResolvedValue({
      ...numberedStructure,
      solutionPattern: {
        location: 'inline',
        matchesQuestionNumbering: true,
        inlineFormat: 'Ans:',
      },
    });
    const markdown = [
      '1. First',
      '2. Second',
      '1. Answer one',
      '2. Answer two',
    ].join('\n');

    const result = await strategy.parseWithResult(markdown);
    expect(
      result.warnings.some(w => w.message.includes('Repeated numbering')),
    ).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('splits headerless Sol. answers and records reattach notes', async () => {
    detectStructure.mockResolvedValue({
      ...numberedStructure,
      questionPattern: {
        type: 'labeled',
        regex: '^Q\\.(\\d+)\\.\\s',
        exampleMatch: 'Q.1. One',
      },
      solutionPattern: {
        location: 'inline',
        matchesQuestionNumbering: false,
      },
    });
    const markdown = `
Q.1. First question
(a) 1
(b) 2
Q.2. Second question
(a) 1
(b) 2
Sol.1.(a) because
Sol.2.(b) leftover fragment without a number prefix that should reattach
`.trim();

    const result = await strategy.parseWithResult(markdown);
    expect(
      result.warnings.some(w =>
        w.message.includes('Headerless alternate solution'),
      ),
    ).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });
});
