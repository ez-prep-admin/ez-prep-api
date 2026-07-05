import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportFailedQuestionDto } from './persist-questions.dto';

describe('ImportFailedQuestionDto', () => {
  it('accepts a nested question payload from the admin import form', async () => {
    const body = plainToInstance(ImportFailedQuestionDto, {
      question: {
        questionText: {
          en: { text: 'Sample question?', image: null },
          ml: { text: null, image: null },
        },
        optionType: 'text',
        options: [
          {
            id: '08bdaf46-3b78-40d9-b2e8-b024580b5b2a',
            type: 'text',
            en: 'Option A',
            ml: null,
          },
          {
            id: 'c149becf-207b-4d99-9031-6b42cc0fdfef',
            type: 'text',
            en: 'Option B',
            ml: null,
          },
          {
            id: 'e1a7db46-75c4-406f-80a9-113ac36e09c3',
            type: 'text',
            en: 'Option C',
            ml: null,
          },
          {
            id: '423e2e51-533e-4826-ab57-e0355234a79c',
            type: 'text',
            en: 'Option D',
            ml: null,
          },
        ],
        explanation: { en: 'Because A', ml: null, image: null },
        correctAnswer: '08bdaf46-3b78-40d9-b2e8-b024580b5b2a',
        subject: '67bcc447003af8ad9fae358f',
        topic: '67bbc4b3822f6d33b7fb0912',
        exams: ['69d74d04008016a2ac4e9edd'],
        tag: null,
        difficultyLevel: 'medium',
        isActive: true,
        isDeleted: false,
        source: 'PDF_UPLOAD',
      },
    });

    const errors = await validate(body, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(body.question.options[0].id).toBe(
      '08bdaf46-3b78-40d9-b2e8-b024580b5b2a',
    );
  });
});
