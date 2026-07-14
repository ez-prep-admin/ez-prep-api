import * as fs from 'fs';
import * as path from 'path';
import {
  isThinSolution,
  looksLikeSolutionTrailing,
  peelSolutionLikeTrailing,
  reattachOrphanSolutionFragments,
} from './orphan-solution-reattach.util';
import { normalizeDocumentStructure } from './document-structure.normalizer';
import { AdaptiveBoundaryStrategy } from './boundaries/adaptive-boundary.strategy';
import { parseNumberedBlocks } from './numbered-block.parser';
import { splitHeaderlessAlternateSolutions } from './headerless-solution-split.util';
import { MarkdownImageExtractorService } from '../mapper/markdown-image.extractor';
import { DocumentStructure } from '../types/document-structure';

describe('orphan-solution-reattach.util', () => {
  it('detects Short Trick trailing as solution-like', () => {
    expect(
      looksLikeSolutionTrailing(
        '![](https://cdn.mathpix.com/a.jpg)\nShort Trick :-\n![](https://cdn.mathpix.com/b.jpg)\nPD = 8.5',
      ),
    ).toBe(true);
  });

  it('keeps short Fig. trailing as stem diagram', () => {
    expect(
      looksLikeSolutionTrailing(
        '![](https://cdn.mathpix.com/a.jpg)\nFig. 19.1',
      ),
    ).toBe(false);
  });

  it('peels solution-like trailing from a question block', () => {
    const content = `In the given figure find PD.
![](https://cdn.mathpix.com/stem.jpg)
(a) 9
(b) 8.5
![](https://cdn.mathpix.com/sol.jpg)
Perimeter = PQ+QR+RP
Short Trick :-
![](https://cdn.mathpix.com/trick.jpg)
PD = 8.5`;

    const peeled = peelSolutionLikeTrailing(content);
    expect(peeled.orphan).toContain('Short Trick');
    expect(peeled.question).toContain('(b) 8.5');
    expect(peeled.question).not.toContain('Short Trick');
  });

  it('reattaches orphan + absorbed sibling on the SSC circle fixture', () => {
    const fixturePath = path.join(
      process.cwd(),
      'SSC_Maths_6800_ebp_MCQ_book_2026_eduquity_based_new_pattern_chapterwise__3___1_.md',
    );
    if (!fs.existsSync(fixturePath)) {
      return;
    }

    const md = fs.readFileSync(fixturePath, 'utf-8');
    const structure = normalizeDocumentStructure(md, {
      questionPattern: {
        type: 'labeled',
        regex: '^Q\\.(\\d+)\\.\\s',
        exampleMatch: 'Q.65.',
      },
      solutionPattern: {
        location: 'separate',
        matchesQuestionNumbering: false,
      },
      delimiter: { type: 'blank-line', value: '', confidence: 0.9 },
      metadata: {
        hasDifficulty: false,
        hasMarks: false,
        hasSubjectLabels: false,
      },
      detectedFormat: 'SSC',
      confidence: 0.9,
    } as DocumentStructure);

    const alt = splitHeaderlessAlternateSolutions(
      md,
      structure.questionPattern.regex,
      structure.solutionPattern.numberingRegex,
    );
    expect(alt?.split).toBe(true);

    const qb = new AdaptiveBoundaryStrategy();
    qb.initialize({
      ...structure,
      solutionPattern: {
        ...structure.solutionPattern,
        numberingRegex: alt!.numberingRegex,
      },
    });
    const sb = qb.createSolutionBoundary({
      ...structure,
      solutionPattern: {
        ...structure.solutionPattern,
        numberingRegex: alt!.numberingRegex,
      },
    });

    const questions = parseNumberedBlocks(alt!.questionsSection, qb).map(
      block => ({ number: block.number, content: block.content }),
    );
    const solutions = parseNumberedBlocks(alt!.solutionsSection, sb).map(
      block => ({ number: block.number, content: block.content }),
    );

    const result = reattachOrphanSolutionFragments(questions, solutions);
    const sol65 = result.solutions.find(item => item.number === 65);
    const sol66 = result.solutions.find(item => item.number === 66);
    const sol69 = result.solutions.find(item => item.number === 69);
    const q70 = result.questions.find(item => item.number === 70);

    expect(sol66?.content).toContain('Short Trick');
    expect(sol66?.content).toMatch(/!\[/);
    expect((sol66?.content.match(/!\[/g) || []).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(q70?.content).not.toContain('Short Trick');

    expect(sol65?.content).toMatch(/!\[/);
    expect((sol65?.content.match(/!\[/g) || []).length).toBe(2);

    expect(sol69?.content).toContain('48');
    expect(sol69?.content).toMatch(/!\[/);
    expect(isThinSolution(sol69!.content)).toBe(false);

    const extractor = new MarkdownImageExtractorService();
    const expl65 = extractor.buildExplanationContent('ai', sol65?.content);
    const expl66 = extractor.buildExplanationContent('ai', sol66?.content);
    expect(expl65.images).toHaveLength(2);
    expect(expl66.images.length).toBeGreaterThanOrEqual(2);

    const stem66 = extractor.buildQuestionContent(
      'ai',
      result.questions.find(item => item.number === 66)?.content,
    );
    expect(stem66.images.length).toBeGreaterThanOrEqual(1);
  });
});
