import { QuestionMapper } from './question.mapper';
import { MarkdownImageExtractorService } from './markdown-image.extractor';
import { AiQuestionOutput } from '../types/ai-question-output';
import { PDF_IMPORT_QUESTION_SOURCE } from '../types/import-question';
import { MATHPIX_PENDING_BUCKET } from '../types/import-image-metadata';

describe('QuestionMapper', () => {
  const metadata = {
    subjectId: '67ba32f8f8ac13a9bd5e5758',
    topicId: '6a365809474b7019244e0dbb',
    examIds: ['67bdd043b24c5bec214287c4'],
  };

  const output: AiQuestionOutput = {
    questionText: 'What is 2+2?',
    options: [
      { label: 'a', text: '1' },
      { label: 'b', text: '2' },
      { label: 'c', text: '4' },
      { label: 'd', text: '8' },
    ],
    correctAnswer: 'c',
    explanation: 'Because 2+2=4',
    difficultyLevel: 'easy',
  };

  const image = {
    key: 'img.png',
    bucket: MATHPIX_PENDING_BUCKET,
    region: 'external',
    url: 'https://cdn.mathpix.com/img.png',
  };

  it('maps text options without a source block', () => {
    const extractor = {
      extractOptionContent: jest.fn(),
      buildQuestionContent: jest.fn().mockReturnValue({
        text: 'What is 2+2?',
        image: null,
        images: [],
      }),
      buildExplanationContent: jest.fn().mockReturnValue({
        text: 'Because 2+2=4',
        image: null,
        images: [],
      }),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    const mapped = mapper.map(output, metadata);

    expect(mapped.optionType).toBe('text');
    expect(mapped.options).toHaveLength(4);
    expect(mapped.options.every(option => option.type === 'text')).toBe(true);
    expect(mapped.source).toBe(PDF_IMPORT_QUESTION_SOURCE);
    expect(mapped.explanation.images).toBeUndefined();
    expect(extractor.extractOptionContent).not.toHaveBeenCalled();
  });

  it('maps image options when the source option has an image', () => {
    const extractor = {
      extractOptionContent: jest.fn().mockImplementation((_src, label: string) =>
        label === 'a'
          ? { text: 'diagram', image, images: [image] }
          : { text: '', image: null, images: [] },
      ),
      buildQuestionContent: jest.fn().mockReturnValue({
        text: 'Pick the diagram',
        image: null,
        images: [],
      }),
      buildExplanationContent: jest.fn().mockReturnValue({
        text: 'See figure',
        image,
        images: [image],
      }),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    const mapped = mapper.map(output, metadata, {
      number: 1,
      question: 'source question',
      solution: 'source solution',
    });

    expect(mapped.optionType).toBe('image');
    expect(mapped.options[0]).toMatchObject({
      type: 'image',
      image,
      en: '1',
    });
    expect(extractor.extractOptionContent).toHaveBeenCalled();
  });

  it('throws when the correct answer label cannot be mapped', () => {
    const extractor = {
      extractOptionContent: jest.fn(),
      buildQuestionContent: jest.fn(),
      buildExplanationContent: jest.fn(),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    expect(() =>
      mapper.map(
        { ...output, correctAnswer: 'e' as never, options: output.options },
        metadata,
      ),
    ).toThrow(/Unable to map correct answer label "e"/);
  });

  it('demotes option images that duplicate the stem image URL', () => {
    const stemImage = { ...image, url: 'https://cdn.mathpix.com/stem.png' };
    const extractor = {
      extractOptionContent: jest.fn().mockReturnValue({
        text: '',
        image: stemImage,
        images: [stemImage],
      }),
      buildQuestionContent: jest.fn().mockReturnValue({
        text: 'Stem',
        image: stemImage,
        images: [stemImage],
      }),
      buildExplanationContent: jest.fn().mockReturnValue({
        text: 'Expl',
        image: null,
        images: [],
      }),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    const mapped = mapper.map(
      {
        ...output,
        options: [{ label: 'a', text: '' }],
        correctAnswer: 'a',
      },
      metadata,
      { number: 1, question: 'q', solution: 's' },
    );

    expect(mapped.optionType).toBe('text');
    expect(mapped.options[0]).toEqual({
      id: expect.any(String),
      type: 'text',
      en: '',
      ml: null,
    });
  });

  it('keeps option images whose URL is not in the stem set', () => {
    const optionImage = {
      ...image,
      url: 'https://cdn.mathpix.com/option.png',
    };
    const stemImage = { ...image, url: 'https://cdn.mathpix.com/stem.png' };
    const extractor = {
      extractOptionContent: jest.fn().mockReturnValue({
        text: 'opt',
        image: optionImage,
        images: [optionImage],
      }),
      buildQuestionContent: jest.fn().mockReturnValue({
        text: 'Stem',
        image: stemImage,
        images: [stemImage],
      }),
      buildExplanationContent: jest.fn().mockReturnValue({
        text: 'Expl',
        image: null,
        images: [],
      }),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    const mapped = mapper.map(
      { ...output, options: [{ label: 'a', text: 'opt' }], correctAnswer: 'a' },
      metadata,
      { number: 1, question: 'q', solution: 's' },
    );

    expect(mapped.options[0].type).toBe('image');
    expect(mapped.optionType).toBe('image');
  });

  it('falls back through option text sources and includes extra explanation images', () => {
    const extra = {
      key: 'extra.png',
      bucket: MATHPIX_PENDING_BUCKET,
      region: 'external',
      url: 'https://cdn.mathpix.com/extra.png',
    };
    const extractor = {
      extractOptionContent: jest.fn().mockReturnValue({
        text: 'from-source',
        image: null,
        images: [],
      }),
      buildQuestionContent: jest.fn().mockReturnValue({
        text: 'Stem',
        image: null,
        images: [{ ...image, url: undefined }],
      }),
      buildExplanationContent: jest.fn().mockReturnValue({
        text: 'long explanation',
        image,
        images: [image, extra],
      }),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    const mapped = mapper.map(
      {
        ...output,
        options: [{ label: 'a', text: '' }],
        correctAnswer: 'a',
      },
      metadata,
      { number: 1, question: 'q with latex \\frac{1}{2}', solution: 's' },
    );

    expect(mapped.options[0].en).toBeTruthy();
    expect(mapped.explanation.image).toEqual(image);
    expect(mapped.explanation.images).toEqual([extra]);
  });

  it('uses empty option text when every fallback is blank', () => {
    const extractor = {
      extractOptionContent: jest.fn().mockReturnValue({
        text: '',
        image: null,
        images: [],
      }),
      buildQuestionContent: jest.fn().mockReturnValue({
        text: 'Stem',
        image: null,
        images: [],
      }),
      buildExplanationContent: jest.fn().mockReturnValue({
        text: 'Expl',
        image: null,
        images: [],
      }),
    };
    const mapper = new QuestionMapper(
      extractor as unknown as MarkdownImageExtractorService,
    );

    const mapped = mapper.map(
      {
        ...output,
        options: [{ label: 'a', text: '' }],
        correctAnswer: 'a',
      },
      metadata,
      { number: 1, question: 'plain', solution: 's' },
    );

    expect(mapped.options[0].en).toBe('');
    expect(mapped.options[0].type).toBe('text');
  });
});
