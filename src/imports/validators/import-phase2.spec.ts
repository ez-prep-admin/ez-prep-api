import { AiOutputValidator } from './ai-output.validator';
import { BusinessValidator } from './business.validator';
import { QuestionMapper } from '../mapper/question.mapper';
import { MarkdownImageExtractorService } from '../mapper/markdown-image.extractor';
import { QuestionChunkerService } from '../chunking/question-chunker.service';
import { NEET_BUSINESS_VALIDATOR_CONFIG } from '../config/business-validator.config';
import { AiQuestionOutput } from '../types/ai-question-output';
import { MatchedQuestion } from '../types/matched-question';
import { MATHPIX_PENDING_BUCKET } from '../types/import-image-metadata';

describe('Phase 2 import validators and mapper', () => {
  const aiValidator = new AiOutputValidator();
  const businessValidator = new BusinessValidator();
  const imageExtractor = new MarkdownImageExtractorService();
  const mapper = new QuestionMapper(imageExtractor);
  const chunker = new QuestionChunkerService();

  const validOutput: AiQuestionOutput = {
    questionText:
      'Alpha particles are fired at a nucleus. Which path is not possible?',
    options: [
      { label: 'a', text: '1' },
      { label: 'b', text: '2' },
      { label: 'c', text: '3' },
      { label: 'd', text: '4' },
    ],
    correctAnswer: 'c',
    explanation:
      'The nucleus repels the positively charged alpha particle, so path 3 is impossible.',
    difficultyLevel: 'medium',
  };

  const questionWithImageSource: MatchedQuestion = {
    number: 1,
    question: `Alpha particles are fired at a nucleus. Which of the paths shown in Fig. 19.1 is not possible?
(a) 1
(b) 2
(c) 3
(d) 4

![](https://cdn.mathpix.com/cropped/example-1.jpg?height=287&width=458)
Fig. 19.1`,
    solution: 'Path 3 is not possible.',
  };

  it('validates a correct AI JSON payload with Zod', () => {
    const validated = aiValidator.validate(JSON.stringify(validOutput));

    expect(validated.correctAnswer).toBe('c');
    expect(validated.options).toHaveLength(4);
  });

  it('rejects malformed AI JSON', () => {
    expect(() => aiValidator.validate('{bad json')).toThrow(
      'Model response is not valid JSON.',
    );
  });

  it('passes NEET business validation', () => {
    expect(() =>
      businessValidator.validate(validOutput, NEET_BUSINESS_VALIDATOR_CONFIG),
    ).not.toThrow();
  });

  it('rejects wrong option count for NEET', () => {
    expect(() =>
      businessValidator.validate(
        {
          ...validOutput,
          options: validOutput.options.slice(0, 3),
        },
        NEET_BUSINESS_VALIDATOR_CONFIG,
      ),
    ).toThrow('Model output failed business validation.');
  });

  it('maps validated output to the Question schema shape with option UUIDs', () => {
    const mapped = mapper.map(validOutput, {
      subjectId: '67ba32f8f8ac13a9bd5e5758',
      topicId: '6a365809474b7019244e0dbb',
      examIds: ['67bdd043b24c5bec214287c4'],
    });

    expect(mapped.optionType).toBe('text');
    expect(mapped.questionText.en.text).toContain('Alpha particles');
    expect(mapped.questionText.ml.text).toBeNull();
    expect(mapped.options).toHaveLength(4);
    expect(mapped.options.every(option => option.id.length > 0)).toBe(true);

    const correctOption = mapped.options.find(
      option => option.id === mapped.correctAnswer,
    );

    expect(correctOption?.en).toBe('3');
    expect(mapped.subject).toBe('67ba32f8f8ac13a9bd5e5758');
    expect(mapped.topic).toBe('6a365809474b7019244e0dbb');
    expect(mapped.exams).toEqual(['67bdd043b24c5bec214287c4']);
    expect(mapped.difficultyLevel).toBe('medium');
    expect(mapped.isActive).toBe(true);
    expect(mapped.isDeleted).toBe(false);
  });

  it('extracts question images into image metadata instead of question text', () => {
    const aiOutputWithEmbeddedImage: AiQuestionOutput = {
      ...validOutput,
      questionText: `Alpha particles are fired at a nucleus. Which of the paths shown in Fig. 19.1 is not possible?

![](https://cdn.mathpix.com/cropped/example-1.jpg?height=287&width=458)
Fig. 19.1`,
    };

    const mapped = mapper.map(
      aiOutputWithEmbeddedImage,
      {
        subjectId: '67ba32f8f8ac13a9bd5e5758',
        topicId: '6a365809474b7019244e0dbb',
        examIds: ['67bdd043b24c5bec214287c4'],
      },
      questionWithImageSource,
    );

    expect(mapped.questionText.en.text).not.toContain('![](');
    expect(mapped.questionText.en.text).toContain('Fig. 19.1');
    expect(mapped.questionText.en.image?.url).toContain(
      'cdn.mathpix.com/cropped/example-1.jpg',
    );
    expect(mapped.questionText.en.image?.bucket).toBe(MATHPIX_PENDING_BUCKET);
    expect(mapped.questionText.en.image?.key).toContain('cropped/example-1.jpg');
  });

  it('validates batch AI JSON payloads with Zod', () => {
    const validated = aiValidator.validateBatch(
      JSON.stringify({
        questions: [{ number: 1, ...validOutput }],
      }),
    );

    expect(validated).toHaveLength(1);
    expect(validated[0].number).toBe(1);
  });

  it('chunks all questions into a single batch by default', () => {
    const questions: MatchedQuestion[] = Array.from({ length: 20 }, (_, i) => ({
      number: i + 1,
      question: `Q${i + 1}`,
      solution: `S${i + 1}`,
    }));

    const chunks = chunker.chunk(questions);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].questions).toHaveLength(20);
  });
});
