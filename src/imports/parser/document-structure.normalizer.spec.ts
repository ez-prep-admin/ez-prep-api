import * as fs from 'fs';
import * as path from 'path';
import { normalizeDocumentStructure } from './document-structure.normalizer';
import { DocumentStructure } from '../types/document-structure';
import { AdaptiveBoundaryStrategy } from './boundaries/adaptive-boundary.strategy';
import { parseNumberedBlocks } from './numbered-block.parser';

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
});
