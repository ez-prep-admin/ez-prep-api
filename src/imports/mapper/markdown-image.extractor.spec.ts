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

  it('extracts diagrams placed after the option list into question content', () => {
    const source = `Alpha particles are fired at a nucleus. Which of the paths shown in Fig. 19.1 is not possible?
(a) 1
(b) 2
(c) 3
(d) 4

![](https://cdn.mathpix.com/cropped/example-1.jpg?height=287&width=458)
Fig. 19.1`;

    const result = extractor.buildQuestionContent(
      'Alpha particles are fired at a nucleus. Which of the paths shown in Fig. 19.1 is not possible?',
      source,
    );

    expect(result.image?.url).toContain('example-1.jpg');
    expect(result.text).toContain('Fig. 19.1');
    expect(result.text).not.toContain('![](');
  });

  it('does not attach post-option diagrams to the last option label', () => {
    const source = `Alpha particles are fired at a nucleus. Which of the paths shown in Fig. 19.1 is not possible?
(a) 1
(b) 2
(c) 3
(d) 4

![](https://cdn.mathpix.com/cropped/example-1.jpg?height=287&width=458)
Fig. 19.1`;

    expect(extractor.extractOptionContent(source, 'd')).toEqual({
      text: '4',
      image: null,
    });
  });
});
