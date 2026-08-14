import { BadRequestException } from '@nestjs/common';
import { MarkdownParserService } from './markdown-parser.service';

describe('MarkdownParserService', () => {
  const service = new MarkdownParserService();

  it('returns the full document as questions when no solutions header is set', () => {
    const markdown = '1. First question\r\n\t2. Second';

    const result = service.parse(markdown, { solutionsHeader: '' });

    expect(result.questionsSection).toContain('1. First question');
    expect(result.solutionsSection).toBe('');
    expect(result.rawMarkdown).not.toContain('\r');
  });

  it('splits questions and solutions on the solutions header', () => {
    const markdown = `1. Q one\n\n## SOLUTIONS\n\n1. Answer`;

    const result = service.parse(markdown, { solutionsHeader: '## SOLUTIONS' });

    expect(result.questionsSection).toBe('1. Q one');
    expect(result.solutionsSection).toBe('1. Answer');
  });

  it('throws when the solutions header is missing from the document', () => {
    expect(() =>
      service.parse('1. Question only', { solutionsHeader: '## ANSWERS' }),
    ).toThrow(BadRequestException);
  });

  it('escapes regex special characters in the solutions header', () => {
    const markdown = 'Q\n\n## A. (1)\n\nsol';

    const result = service.parse(markdown, { solutionsHeader: '## A. (1)' });

    expect(result.solutionsSection).toBe('sol');
  });
});
