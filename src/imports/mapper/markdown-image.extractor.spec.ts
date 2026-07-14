import { MarkdownImageExtractorService } from './markdown-image.extractor';

describe('MarkdownImageExtractorService', () => {
  const extractor = new MarkdownImageExtractorService();

  it('removes markdown image syntax and returns image metadata', () => {
    const result = extractor.extractFromText(
      'See the diagram below.\n\n![](https://cdn.mathpix.com/cropped/example.jpg?height=100)\nFig. 19.1',
    );

    expect(result.text).toContain('See the diagram below.');
    expect(result.text).toContain('Fig. 19.1');
    expect(result.text).not.toContain('![](');    expect(result.image?.url).toBe(
      'https://cdn.mathpix.com/cropped/example.jpg?height=100',
    );
    expect(result.images).toHaveLength(1);
    expect(result.image?.contentType).toBe('image/jpeg');
  });

  it('extracts multiple explanation diagrams in order', () => {
    const result = extractor.buildExplanationContent(
      'AI explanation',
      `Perimeter of diameter:
![](https://cdn.mathpix.com/cropped/one.jpg)
Perimeter of circumference:
![](https://cdn.mathpix.com/cropped/two.jpg)
length = 36+12π`,
    );

    // Extractor keeps full ordered list; mapper/persist split primary vs extras.
    expect(result.images).toHaveLength(2);
    expect(result.image?.url).toContain('one.jpg');
    expect(result.images[1].url).toContain('two.jpg');
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
      images: [],
    });
  });

  it('falls back to source stem when AI unwraps Mathpix LaTeX', () => {
    const source = `Ramesh has \\(₹ 15,000\\). Interest at \\(10 \\%\\).
SSC CGL 17/09/2025 (Shift 3)
(a) ₹9,000
(b) ₹7,500`;

    const result = extractor.buildQuestionContent(
      'Ramesh has ₹15,000. Interest at 10%.',
      source,
    );

    expect(result.text).toContain('\\(₹ 15,000\\)');
    expect(result.text).toContain('\\(10 \\%\\)');
    expect(result.text).not.toContain('SSC CGL');
  });

  it('keeps AI stem when it is a different structured question despite source LaTeX', () => {
    const source = `Some OCR dump with \\(\\alpha\\) and \\(\\beta\\) fragments.
(a) 1
(b) 2`;

    const result = extractor.buildQuestionContent(
      'Which of the following paths is impossible?',
      source,
    );

    expect(result.text).toBe('Which of the following paths is impossible?');
  });
});
