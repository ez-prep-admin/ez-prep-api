import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';
import {
  advanceItemizeDepth,
  parseNumberedBlocks,
} from './numbered-block.parser';

const itemBoundary: QuestionBoundaryStrategy = {
  isQuestionStart: line => /\\item\[(\d+)\.\]/.test(line),
  parseQuestionStart: line => {
    const match = line.match(/\\item\[(\d+)\.\]\s*(.*)$/);
    if (!match) {
      return null;
    }
    return { number: Number(match[1]), content: match[2] };
  },
};

describe('parseNumberedBlocks', () => {
  it('keeps nested itemize statements inside the outer question', () => {
    const markdown = [
      '\\begin{itemize}\\item[16.] Read the statements.',
      'Statements:',
      '\\begin{itemize}',
      '\\item[1.] All boards are black.',
      '\\item[2.] All blacks are white.',
      '\\end{itemize}',
      'Conclusions:',
      '\\begin{itemize}',
      '\\item[1.] No white is black.',
      '\\item[4.] All boards are white.',
      '\\end{itemize}',
      '(a) 2',
      '(c) 4',
      '\\end{itemize}',
      'Ans. (c) : conclusion 4 follows.',
      '\\begin{itemize}',
      '\\item[17.] Select the option.',
      '\\end{itemize}',
      'Ans. (b) : some animals are black.',
    ].join('\n');

    const blocks = parseNumberedBlocks(markdown, itemBoundary);

    expect(blocks.map(block => block.number)).toEqual([16, 17]);
    expect(blocks[0].content).toContain('All boards are black.');
    expect(blocks[0].content).toContain('Ans. (c)');
    expect(blocks[1].content).toContain('Select the option.');
    expect(blocks[1].content).toContain('Ans. (b)');
  });

  it('still splits plain numbered questions', () => {
    const numbered: QuestionBoundaryStrategy = {
      isQuestionStart: line => /^\d+\./.test(line.trim()),
      parseQuestionStart: line => {
        const match = line.trim().match(/^(\d+)\.\s*(.*)$/);
        if (!match) {
          return null;
        }
        return { number: Number(match[1]), content: match[2] };
      },
    };

    expect(
      parseNumberedBlocks('1. First\n2. Second', numbered).map(
        block => block.number,
      ),
    ).toEqual([1, 2]);
  });
});

describe('advanceItemizeDepth', () => {
  it('treats an item on the begin line as depth 1', () => {
    expect(advanceItemizeDepth('\\begin{itemize}\\item[16.] Stem', 0)).toEqual({
      depthAfter: 1,
      nestedItem: false,
    });
  });

  it('treats an item inside an open list as nested', () => {
    expect(advanceItemizeDepth('\\item[1.] All boards are black.', 2)).toEqual({
      depthAfter: 2,
      nestedItem: true,
    });
  });
});
