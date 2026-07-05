import * as fs from 'fs';
import * as path from 'path';
import { normalizeDocumentStructure, isInvalidSolutionMarker } from './document-structure.normalizer';
import { DocumentStructure } from '../types/document-structure';
import { AdaptiveBoundaryStrategy } from './boundaries/adaptive-boundary.strategy';
import { parseNumberedBlocks } from './numbered-block.parser';
import { splitRepeatedInlineNumbering } from './inline-duplicate-split.util';

describe('normalizeDocumentStructure', () => {
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

  const markdownPath = path.join(
    process.cwd(),
    'Aldehydes_and_Ketones_-_JEE_Main_2026__Jan__-_MathonGo (1).md',
  );

  const legacyMarkdownPath = path.join(
    process.cwd(),
    'Aldehydes_and_Ketones_-_JEE_Main_2026__Jan__-_MathonGo.md',
  );

  const mmdMarkdown = fs.existsSync(markdownPath)
    ? fs.readFileSync(markdownPath, 'utf-8')
    : '';
  const legacyMarkdown = fs.existsSync(legacyMarkdownPath)
    ? fs.readFileSync(legacyMarkdownPath, 'utf-8')
    : '';

  it('corrects misdetected inline solutions when a separate answers section exists', () => {
    const markdown = legacyMarkdown || mmdMarkdown;
    if (!markdown) {
      return;
    }

    const normalized = normalizeDocumentStructure(markdown, mathonGoStructure);

    expect(normalized.solutionPattern.location).toBe('separate');
    expect(normalized.questionPattern.regex).toMatch(/Q\(\\d\+\)/);
  });

  it('parses 9 MathonGo questions and 9 solutions after normalization', () => {
    const markdown = legacyMarkdown || mmdMarkdown;
    if (!markdown) {
      return;
    }

    const normalized = normalizeDocumentStructure(markdown, mathonGoStructure);
    const marker = normalized.solutionPattern.marker ?? '';
    const splitIndex = markdown.indexOf(marker);
    expect(splitIndex).toBeGreaterThan(-1);

    const questionsSection = markdown.substring(0, splitIndex).trim();
    const solutionsSection = markdown
      .substring(splitIndex + marker.length)
      .trim();

    const questionBoundary = new AdaptiveBoundaryStrategy();
    questionBoundary.initialize(normalized);

    const solutionBoundary =
      questionBoundary.createSolutionBoundary(normalized);

    const questions = parseNumberedBlocks(questionsSection, questionBoundary);
    const solutions = parseNumberedBlocks(solutionsSection, solutionBoundary);

    expect(questions).toHaveLength(9);
    expect(solutions.length).toBeGreaterThanOrEqual(9);
    expect(questions.map(q => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('reconciles stale ## Q regex when Mathpix outputs LaTeX section headings', () => {
    if (!mmdMarkdown) {
      return;
    }

    const normalized = normalizeDocumentStructure(
      mmdMarkdown,
      mathonGoStructure,
    );

    expect(normalized.questionPattern.regex).toBe(
      '^\\\\section\\*\\{Q(\\d+)\\.',
    );
    expect(normalized.solutionPattern.marker).toBe(
      '\\section*{ANSWERS AND SOLUTIONS}',
    );
  });

  it('rejects horizontal-rule markers hallucinated from structure-detection samples', () => {
    const markdown = [
      '1. Question one',
      '2. Question two',
      '1. Answer one',
      '2. Answer two',
    ].join('\n');

    const normalized = normalizeDocumentStructure(markdown, {
      ...mathonGoStructure,
      solutionPattern: {
        location: 'separate',
        matchesQuestionNumbering: true,
        marker: '---',
      },
    });

    expect(isInvalidSolutionMarker('---')).toBe(true);
    expect(normalized.solutionPattern.marker).toBeUndefined();
    expect(normalized.warnings?.some(w => w.includes('Rejected invalid'))).toBe(
      true,
    );
  });

  it('parses headerless flip-test style documents via repeated numbering split', () => {
    const questions = Array.from({ length: 20 }, (_, index) =>
      `${index + 1}. Question ${index + 1}`,
    );
    const answers = Array.from({ length: 20 }, (_, index) =>
      `${index + 1}. Answer ${index + 1}`,
    );
    const markdown = [...questions, ...answers].join('\n');

    const normalized = normalizeDocumentStructure(markdown, {
      questionPattern: {
        type: 'numbered',
        regex: '^(\\d+)\\.\\s',
        exampleMatch: '1. Question 1',
      },
      solutionPattern: {
        location: 'separate',
        matchesQuestionNumbering: true,
        marker: '---',
      },
      delimiter: { type: 'blank-line', value: '', confidence: 0.8 },
      metadata: {
        hasDifficulty: false,
        hasMarks: false,
        hasSubjectLabels: false,
      },
      detectedFormat: 'Flip test',
      confidence: 0.8,
    });

    expect(normalized.solutionPattern.marker).toBeUndefined();

    const boundary = new AdaptiveBoundaryStrategy();
    boundary.initialize(normalized);
    const parsed = parseNumberedBlocks(markdown, boundary);
    const split = splitRepeatedInlineNumbering(parsed);

    expect(split.split).toBe(true);
    expect(split.questions).toHaveLength(20);
    expect(split.solutions).toHaveLength(20);
  });
});
