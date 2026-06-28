import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';

export interface NumberedBlock {
  number: number;
  content: string;
}

export function parseNumberedBlocks(
  markdown: string,
  boundary: QuestionBoundaryStrategy,
): NumberedBlock[] {
  const blocks: NumberedBlock[] = [];
  const lines = markdown.split('\n');

  let currentNumber: number | null = null;
  let currentLines: string[] = [];

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
    const start = boundary.parseQuestionStart(line);

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
