import { MarkdownImageExtractorService } from './markdown-image.extractor';

describe('MarkdownImageExtractorService', () => {
  const extractor = new MarkdownImageExtractorService();

  it('removes markdown image syntax and returns image metadata', () => {
    const result = extractor.extractFromText(
      'See the diagram below.\n\n![](https://cdn.mathpix.com/cropped/example.jpg?height=100)\nFig. 19.1',
    );

    expect(result.text).toBe('See the diagram below.\nFig. 19.1');
    expect(result.image?.url).toBe(
      'https://cdn.mathpix.com/cropped/example.jpg?height=100',
    );
    expect(result.image?.contentType).toBe('image/jpeg');
  });

  it('prefers images from the source markdown block over AI output', () => {
    const result = extractor.buildQuestionContent(
      'Alpha particles question.\n![](https://cdn.mathpix.com/ai-image.jpg)',
      'Alpha particles question.\n![](https://cdn.mathpix.com/source-image.jpg)\nFig. 19.1',
    );

    expect(result.image?.url).toContain('source-image.jpg');
    expect(result.text).not.toContain('![](');
  });
});
