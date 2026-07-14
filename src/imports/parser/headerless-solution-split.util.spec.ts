import * as fs from 'fs';
import * as path from 'path';
import { splitHeaderlessAlternateSolutions } from './headerless-solution-split.util';
import { MarkdownImageExtractorService } from '../mapper/markdown-image.extractor';
import { AdaptiveBoundaryStrategy } from './boundaries/adaptive-boundary.strategy';
import { parseNumberedBlocks } from './numbered-block.parser';
import { QuestionMatcherService } from './question-matcher.service';
import { normalizeDocumentStructure } from './document-structure.normalizer';
import { DocumentStructure } from '../types/document-structure';

describe('splitHeaderlessAlternateSolutions', () => {
  it('splits Q.N questions from Sol.N answers without a section header', () => {
    const markdown = `
Q.48. First question
(a) 1
(b) 2
(c) 3
(d) 4
Q.49. Second question
(a) 1
(b) 2
(c) 3
(d) 4
Sol.48.(d) Explanation for 48
![](https://cdn.mathpix.com/cropped/example-a.jpg)
Sol.49.(c) Explanation for 49
`.trim();

    const result = splitHeaderlessAlternateSolutions(
      markdown,
      '^Q\\.(\\d+)\\.\\s',
    );

    expect(result?.split).toBe(true);
    expect(result?.numberingRegex).toBe('^Sol\\.(\\d+)\\.');
    expect(result?.questionsSection).toContain('Q.48.');
    expect(result?.questionsSection).not.toContain('Sol.48');
    expect(result?.solutionsSection).toContain('Sol.48.(d)');
    expect(result?.solutionsSection).toContain('![](https://cdn.mathpix.com');
    expect(result?.matchCount).toBe(2);
  });

  it('splits labeled questions from plain numbered answers with option keys', () => {
    const markdown = `
Q.1. Alpha
(a) 1
(b) 2
Q.2. Beta
(a) 1
(b) 2
1. (2) Answer one
2. (1) Answer two
`.trim();

    const result = splitHeaderlessAlternateSolutions(
      markdown,
      '^Q\\.(\\d+)\\.\\s',
    );

    expect(result?.split).toBe(true);
    expect(result?.solutionsSection).toContain('1. (2)');
    expect(result?.questionsSection).not.toContain('1. (2)');
  });

  it('does not split when Sol lines are interleaved (inline solutions)', () => {
    const markdown = `
Q.1. First
Sol.1.(a) inline answer
Q.2. Second
Sol.2.(b) inline answer
`.trim();

    const result = splitHeaderlessAlternateSolutions(
      markdown,
      '^Q\\.(\\d+)\\.\\s',
    );

    expect(result).toBeNull();
  });

  it('does not treat same-prefix numbering as an alternate split', () => {
    const markdown = `
1. Question one
2. Question two
1. Answer one
2. Answer two
`.trim();

    const result = splitHeaderlessAlternateSolutions(markdown, '^(\\d+)\\.\\s');

    expect(result).toBeNull();
  });

  it('prefers LLM-provided solution numbering regex when valid', () => {
    const markdown = `
Q.1. One
Q.2. Two
Answer 1: because
Answer 2: because
`.trim();

    const result = splitHeaderlessAlternateSolutions(
      markdown,
      '^Q\\.(\\d+)\\.\\s',
      '^Answer\\s+(\\d+):',
    );

    expect(result?.split).toBe(true);
    expect(result?.numberingRegex).toBe('^Answer\\s+(\\d+):');
  });
});

describe('SSC Maths headerless Sol. PDF fixture', () => {
  const fixturePath = path.join(
    process.cwd(),
    'SSC_Maths_6800_ebp_MCQ_book_2026_eduquity_based_new_pattern_chapterwise__2_.md',
  );
  const markdown = fs.existsSync(fixturePath)
    ? fs.readFileSync(fixturePath, 'utf-8')
    : '';

  const structureSeed: DocumentStructure = {
    questionPattern: {
      type: 'labeled',
      regex: '^Q\\.(\\d+)\\.\\s',
      exampleMatch: 'Q.48. Sunil lent',
    },
    solutionPattern: {
      location: 'separate',
      matchesQuestionNumbering: false,
    },
    delimiter: { type: 'blank-line', value: '', confidence: 0.9 },
    metadata: {
      hasDifficulty: false,
      hasMarks: false,
      hasSubjectLabels: true,
      examType: 'SSC CGL',
    },
    detectedFormat: 'SSC headerless Sol.N',
    confidence: 0.9,
  };

  it('infers Sol. numbering and attaches explanation images', () => {
    if (!markdown) {
      return;
    }

    const normalized = normalizeDocumentStructure(markdown, structureSeed);
    expect(normalized.solutionPattern.numberingRegex).toBe('^Sol\\.(\\d+)\\.');
    expect(normalized.solutionPattern.location).toBe('separate');
    expect(normalized.solutionPattern.matchesQuestionNumbering).toBe(false);

    const altSplit = splitHeaderlessAlternateSolutions(
      markdown,
      normalized.questionPattern.regex,
      normalized.solutionPattern.numberingRegex,
    );
    expect(altSplit?.split).toBe(true);

    const questionBoundary = new AdaptiveBoundaryStrategy();
    questionBoundary.initialize(normalized);
    const solutionBoundary =
      questionBoundary.createSolutionBoundary(normalized);

    const questions = parseNumberedBlocks(
      altSplit!.questionsSection,
      questionBoundary,
    );
    const solutions = parseNumberedBlocks(
      altSplit!.solutionsSection,
      solutionBoundary,
    );

    expect(questions.map(q => q.number)).toEqual([
      48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    ]);
    expect(solutions.map(s => s.number)).toEqual([
      48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    ]);

    const matched = new QuestionMatcherService().match(questions, solutions);
    const imageExtractor = new MarkdownImageExtractorService();

    for (const number of [52, 54, 56, 57]) {
      const item = matched.find(m => m.number === number);
      expect(item?.solution).toContain('![](');
      const explanation = imageExtractor.buildExplanationContent(
        'AI explanation without images',
        item?.solution,
      );
      expect(explanation.image?.url).toContain('cdn.mathpix.com');
    }

    const lastQuestion = matched.find(m => m.number === 59);
    expect(lastQuestion?.question).not.toContain('Sol.48');
    expect(lastQuestion?.question).not.toContain('![](');
  });
});
