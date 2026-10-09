import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';

export interface NumberedBlock {
  number: number;
  content: string;
}

const ITEMIZE_TOKEN = /\\begin\{itemize\*?\}|\\end\{itemize\*?\}|\\item\[/g;

/**
 * Mathpix wraps both the question and its statements in itemize.
 * `\item[16.]` at the outer list is a question. `\item[1.]` inside that
 * question is a statement or conclusion and must stay in the same block.
 */
export function advanceItemizeDepth(
  line: string,
  depth: number,
): { depthAfter: number; nestedItem: boolean } {
  let current = depth;
  let depthAtItem: number | null = null;

  for (const match of line.matchAll(ITEMIZE_TOKEN)) {
    const token = match[0];
    if (token.startsWith('\\begin')) {
      current += 1;
    } else if (token.startsWith('\\end')) {
      current = Math.max(0, current - 1);
    } else if (depthAtItem === null) {
      depthAtItem = current;
    }
  }

  return {
    depthAfter: current,
    nestedItem: depthAtItem !== null && depthAtItem > 1,
  };
}

export function parseNumberedBlocks(
  markdown: string,
  boundary: QuestionBoundaryStrategy,
): NumberedBlock[] {
  const blocks: NumberedBlock[] = [];
  const lines = markdown.split('\n');

  let currentNumber: number | null = null;
  let currentLines: string[] = [];
  let itemizeDepth = 0;

  const flush = () => {
    if (currentNumber === null) {
      return;
    }

    blocks.push({
      number: currentNumber,
      content: currentLines.join('\n').trim(),
    });
  };

  for (const line of lines) {
    const itemize = advanceItemizeDepth(line, itemizeDepth);
    itemizeDepth = itemize.depthAfter;
    const start = itemize.nestedItem ? null : boundary.parseQuestionStart(line);

    if (start) {
      flush();
      currentNumber = start.number;
      currentLines = start.content ? [start.content] : [];
      continue;
    }

    if (currentNumber !== null) {
      currentLines.push(line);
    }
  }

  flush();
  return blocks;
}
