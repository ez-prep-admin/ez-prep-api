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

const img = (name: string) => `![](https://cdn.mathpix.com/${name}.jpg)`;

function q(number: number, content: string) {
  return { number, content };
}

function s(number: number, content: string) {
  return { number, content };
}

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

  it('does not peel when there are no option lines', () => {
    expect(peelSolutionLikeTrailing('Just a stem')).toEqual({
      question: 'Just a stem',
      orphan: null,
    });
  });

  it('does not peel when trailing is not solution-like', () => {
    const content = '(a) 1\n(b) 2\nshort note';
    expect(peelSolutionLikeTrailing(content).orphan).toBeNull();
  });

  it('looksLikeSolutionTrailing rejects empty text', () => {
    expect(looksLikeSolutionTrailing('   ')).toBe(false);
  });

  it('treats a single short image as stem diagram', () => {
    expect(looksLikeSolutionTrailing(`${img('a')}\nxy`)).toBe(false);
  });

  it('treats two or more images as solution trailing', () => {
    expect(looksLikeSolutionTrailing(`${img('a')}\n${img('b')}`)).toBe(true);
  });

  it('treats a long diagram plus geometry keywords as solution trailing', () => {
    const text = `${img('a')}\n${'radius of the circle using pythagoras theorem '.repeat(4)}`;
    expect(looksLikeSolutionTrailing(text)).toBe(true);
  });

  it('returns false for a long image caption without geometry keywords', () => {
    const text = `${img('a')}\n${'hello world hello world '.repeat(8)}`;
    expect(looksLikeSolutionTrailing(text)).toBe(false);
  });

  it('counts includegraphics as images for thin solutions', () => {
    expect(isThinSolution('\\includegraphics{https://x.com/a.jpg} hi')).toBe(
      false,
    );
    expect(isThinSolution('(b) 42')).toBe(true);
  });

  it('puts the orphan back when no thin solution exists', () => {
    const questions = [
      q(
        1,
        `(a) 1\n(b) 2\n${img('sol')}\nPerimeter = PQ+QR+RP\nShort Trick :-\n${img('trick')}\nPD = 8.5`,
      ),
    ];
    const solutions = [
      s(
        1,
        `${img('a')}\n${img('b')}\nlong explanation about perimeter and radius that is definitely not thin`,
      ),
    ];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.questions[0].content).toContain('Short Trick');
    expect(result.notes[0]).toMatch(/no thin Sol/);
  });

  it('reattaches to the only thin solution', () => {
    const questions = [
      q(
        1,
        `(a) 1\n(b) 2\n${img('sol')}\nPerimeter = PQ+QR+RP\nShort Trick :-\n${img('trick')}\nPD = 8.5`,
      ),
    ];
    const solutions = [s(1, '(a) 9')];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.solutions[0].content).toContain('Short Trick');
    expect(result.questions[0].content).not.toContain('Short Trick');
    expect(result.notes[0]).toMatch(/Reattached orphan/);
  });

  it('picks the overlapping thin solution among several', () => {
    const orphanTail = `${img('sol')}\nPerimeter chord tangent radius pythagoras extra uniquealpha uniquepdq\nShort Trick :-\n${img('trick')}`;
    const questions = [
      q(1, `(a) 1\n(b) 2\n${orphanTail}`),
      q(2, 'unrelated beta question about apples oranges bananas cherries'),
    ];
    const solutions = [s(1, 'ok'), s(2, 'fine')];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.solutions.find(item => item.number === 1)?.content).toContain(
      'Short Trick',
    );
  });

  it('falls back to the first thin solution when overlap is zero', () => {
    const questions = [
      q(
        1,
        `(a) 1\n(b) 2\n${img('sol')}\nzzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz zzzz\nShort Trick :-\n${img('trick')}`,
      ),
    ];
    const solutions = [s(9, 'thin-a'), s(8, 'thin-b')];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.solutions[0].content).toContain('Short Trick');
  });

  it('does not duplicate orphan text already present in the solution', () => {
    const tail = `${img('sol')}\nPerimeter = PQ+QR+RP uniqueomega\nShort Trick :-\n${img('trick')}\nPD = 8.5`;
    const questions = [q(1, `(a) 1\n(b) 2\n${tail}`)];
    const solutions = [s(1, tail)];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.solutions[0].content.split('Short Trick').length).toBe(2);
  });

  it('splits an absorbed sibling after Short Trick when a later diagram matches a thin sol', () => {
    const padding = 'uniquekappa uniquelambda uniquemu uniquenu';
    const head = `${img('one')}\nShort Trick :-\n${'x'.repeat(90)}\n`;
    const tail = `${img('two')}\n${padding} ${'diagram details '.repeat(10)}`;
    const questions = [
      q(1, 'question one about circles'),
      q(2, `question two ${padding}`),
    ];
    const solutions = [s(1, `${head}${tail}`), s(2, '(a) 3')];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.notes.some(note => note.includes('Split absorbed'))).toBe(
      true,
    );
    expect(result.solutions.find(item => item.number === 2)?.content).toContain(
      'uniquekappa',
    );
  });

  it('does not split when the only post-trick image is immediately under the heading', () => {
    const content = `${img('one')}\nShort Trick :-\n${img('two')}\nshort`;
    const result = reattachOrphanSolutionFragments(
      [q(1, 'q'), q(2, 'r')],
      [s(1, content), s(2, 'thin')],
    );
    expect(result.notes.some(note => note.includes('Split absorbed'))).toBe(
      false,
    );
  });

  it('does not split when there is no image after Short Trick', () => {
    const result = reattachOrphanSolutionFragments(
      [q(1, 'q')],
      [s(1, 'Short Trick :- just text without diagrams')],
    );
    expect(result.solutions[0].content).toContain('Short Trick');
  });

  it('does not split when post-trick tail is too short', () => {
    const content = `Short Trick :-\n${'gap '.repeat(30)}${img('far')}\nshort`;
    const result = reattachOrphanSolutionFragments(
      [q(1, 'q'), q(2, 'uniquezeta uniqueeta')],
      [s(1, content), s(2, 'thin')],
    );
    expect(result.notes.some(note => note.includes('Split absorbed'))).toBe(
      false,
    );
  });

  it('does not split when there is no other thin solution', () => {
    const head = `Short Trick :-\n${'x'.repeat(90)}\n`;
    const tail = `${img('two')}\n${'diagram details '.repeat(10)} uniqueiota`;
    const result = reattachOrphanSolutionFragments(
      [q(1, 'q')],
      [
        s(1, `${head}${tail}`),
        s(
          2,
          `${img('a')}\n${img('b')}\nthis sibling is rich not thin because of images`,
        ),
      ],
    );
    expect(result.notes.some(note => note.includes('Split absorbed'))).toBe(
      false,
    );
  });

  it('does not split when thin solutions have no matching questions', () => {
    const head = `Short Trick :-\n${'x'.repeat(90)}\n`;
    const tail = `${img('two')}\n${'diagram details '.repeat(10)} uniqueomicron`;
    const result = reattachOrphanSolutionFragments(
      [q(1, 'question one')],
      [s(1, `${head}${tail}`), s(99, 'thin')],
    );
    expect(result.notes.some(note => note.includes('Split absorbed'))).toBe(
      false,
    );
  });

  it('does not split when overlap score is below threshold', () => {
    const head = `Short Trick :-\n${'x'.repeat(90)}\n`;
    const tail = `${img('two')}\n${'zzzzzzzz zzzzzzzz '.repeat(8)}`;
    const result = reattachOrphanSolutionFragments(
      [q(1, 'question one'), q(2, 'apples oranges bananas cherries')],
      [s(1, `${head}${tail}`), s(2, 'thin')],
    );
    expect(result.notes.some(note => note.includes('Split absorbed'))).toBe(
      false,
    );
  });

  it('merges onto an empty existing solution body', () => {
    const questions = [
      q(
        1,
        `(a) 1\n(b) 2\n${img('sol')}\nPerimeter = PQ+QR+RP\nShort Trick :-\n${img('trick')}\nPD = 8.5`,
      ),
    ];
    const result = reattachOrphanSolutionFragments(questions, [s(1, '   ')]);
    expect(result.solutions[0].content.trim().length).toBeGreaterThan(0);
  });

  it('skips split when the rich solution has no short trick and fewer than two images', () => {
    const result = reattachOrphanSolutionFragments(
      [q(1, 'q')],
      [s(1, `${img('only')} a reasonably long explanation without a trick`)],
    );
    expect(result.notes).toEqual([]);
  });

  it('leaves questions unchanged when nothing peels', () => {
    const questions = [q(1, '(a) 1\n(b) 2')];
    const solutions = [s(1, 'answer')];
    const result = reattachOrphanSolutionFragments(questions, solutions);
    expect(result.questions[0].content).toBe(questions[0].content);
    expect(result.solutions[0].content).toBe('answer');
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
