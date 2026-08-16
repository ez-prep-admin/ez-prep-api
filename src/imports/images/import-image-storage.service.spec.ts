import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import {
  ImportImageStorageService,
  ImportImageMaterializeError,
} from './import-image-storage.service';
import { S3Service } from '../../aws/s3/s3.service';
import { AwsConfigService } from '../../aws/config/aws.config';
import {
  ImportQuestion,
  PDF_IMPORT_QUESTION_SOURCE,
} from '../types/import-question';
import { MATHPIX_PENDING_BUCKET } from '../types/import-image-metadata';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const uploadId = '507f1f77bcf86cd799439011';

function pendingImage(url: string) {
  return {
    key: 'pending',
    bucket: MATHPIX_PENDING_BUCKET,
    region: 'external',
    url,
    contentType: 'image/png',
  };
}

function makeQuestion(overrides: Partial<ImportQuestion> = {}): ImportQuestion {
  return {
    questionText: {
      en: { text: 'Stem', image: null },
      ml: { text: null, image: null },
    },
    optionType: 'text',
    options: [{ id: 'a', type: 'text', en: 'A', ml: null }],
    explanation: { en: 'exp', ml: null, image: null },
    correctAnswer: 'a',
    subject: uploadId,
    topic: uploadId,
    exams: [],
    difficultyLevel: 'easy',
    isActive: true,
    isDeleted: false,
    source: PDF_IMPORT_QUESTION_SOURCE,
    ...overrides,
  };
}

describe('ImportImageStorageService', () => {
  let service: ImportImageStorageService;
  const s3Service = {
    generateImportImageKey: jest.fn().mockReturnValue('imports/img.png'),
    uploadFile: jest.fn().mockResolvedValue({ key: 'imports/img.png' }),
    getPresignedUrl: jest.fn().mockResolvedValue({
      url: 'https://s3.example/presigned',
    }),
  };
  const awsConfig = {
    s3ImageBucket: 'image-bucket',
    region: 'ap-south-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: Buffer.from('png-bytes') });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportImageStorageService,
        { provide: S3Service, useValue: s3Service },
        { provide: AwsConfigService, useValue: awsConfig },
      ],
    }).compile();
    service = module.get(ImportImageStorageService);
  });

  it('returns the question unchanged when there are no images', async () => {
    const question = makeQuestion();
    const result = await service.materializeQuestionImages(question, {
      uploadId,
      questionNumber: 1,
    });
    expect(result.options[0].image).toBeUndefined();
    expect(s3Service.uploadFile).not.toHaveBeenCalled();
  });

  it('downloads pending images, uploads to S3, and caches by URL', async () => {
    const url = 'https://cdn.mathpix.com/fig.png';
    const question = makeQuestion({
      questionText: {
        en: { text: 'Stem', image: pendingImage(url) },
        ml: { text: null, image: null },
      },
      explanation: {
        en: 'exp',
        ml: null,
        image: pendingImage(url),
        images: [pendingImage(url)],
      },
      options: [
        { id: 'a', type: 'text', en: 'A', ml: null, image: pendingImage(url) },
      ],
    });

    const result = await service.materializeQuestionImages(question, {
      uploadId,
      questionNumber: 2,
    });

    expect(s3Service.uploadFile).toHaveBeenCalled();
    expect(result.questionText.en.image?.bucket).toBe('image-bucket');
    expect(result.options[0].type).toBe('image');
    expect(result.explanation.image?.url).toBe('https://s3.example/presigned');
  });

  it('throws when a pending image has no URL', async () => {
    const question = makeQuestion({
      questionText: {
        en: {
          text: 'Stem',
          image: {
            key: 'x',
            bucket: MATHPIX_PENDING_BUCKET,
            region: 'external',
          },
        },
        ml: { text: null, image: null },
      },
    });

    await expect(
      service.materializeQuestionImages(question, {
        questionNumber: 1,
      }),
    ).rejects.toBeInstanceOf(ImportImageMaterializeError);
  });

  it('wraps download failures', async () => {
    mockedAxios.get.mockRejectedValue(new Error('timeout'));
    const question = makeQuestion({
      explanation: {
        en: 'exp',
        ml: null,
        image: pendingImage('https://cdn.example/x.jpg'),
      },
    });

    await expect(
      service.materializeQuestionImages(question, { questionNumber: 1 }),
    ).rejects.toThrow(/Failed to download image/);
  });

  it('refreshes presigned URLs for stored images in the image bucket', async () => {
    const stored = {
      key: 'k',
      bucket: 'image-bucket',
      region: 'old',
      contentType: 'image/jpeg',
      url: 'stale',
    };
    const question = makeQuestion({
      questionText: {
        en: { text: 'Stem', image: stored },
        ml: { text: null, image: null },
      },
    });

    const result = await service.materializeQuestionImages(question, {
      questionNumber: 1,
    });

    expect(s3Service.getPresignedUrl).toHaveBeenCalled();
    expect(result.questionText.en.image?.url).toBe(
      'https://s3.example/presigned',
    );
  });

  it('leaves stored images in other buckets unchanged', async () => {
    const stored = {
      key: 'k',
      bucket: 'other-bucket',
      region: 'us-east-1',
    };
    const question = makeQuestion({
      questionText: {
        en: { text: 'Stem', image: stored },
        ml: { text: null, image: null },
      },
    });

    const result = await service.materializeQuestionImages(question, {
      questionNumber: 1,
    });
    expect(result.questionText.en.image).toEqual(stored);
  });

  it('reuses the session cache for the same pending URL', async () => {
    const url = 'https://cdn.mathpix.com/shared.webp';
    await service.materializeQuestionImages(
      makeQuestion({
        questionText: {
          en: {
            text: 'Stem',
            image: {
              key: 'pending',
              bucket: MATHPIX_PENDING_BUCKET,
              region: 'external',
              url,
              contentType: 'image/webp',
            },
          },
          ml: { text: null, image: null },
        },
      }),
      { questionNumber: 1 },
    );
    await service.materializeQuestionImages(
      makeQuestion({
        explanation: {
          en: 'e',
          ml: null,
          image: {
            key: 'pending',
            bucket: MATHPIX_PENDING_BUCKET,
            region: 'external',
            url,
            contentType: 'image/webp',
          },
        },
      }),
      { questionNumber: 2 },
    );
    expect(s3Service.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('infers gif/webp/png extensions and content types from URLs', async () => {
    mockedAxios.get.mockResolvedValue({ data: Buffer.from('img') });
    const question = makeQuestion({
      explanation: {
        en: 'e',
        ml: null,
        image: null,
        images: [
          {
            key: 'p',
            bucket: MATHPIX_PENDING_BUCKET,
            region: 'external',
            url: 'https://cdn.example/a.gif',
          },
        ],
      },
      options: [
        {
          id: 'a',
          type: 'text',
          en: 'A',
          ml: null,
          image: {
            key: 'p',
            bucket: MATHPIX_PENDING_BUCKET,
            region: 'external',
            url: 'https://cdn.example/noext',
          },
        },
      ],
    });

    await service.materializeQuestionImages(question, { questionNumber: 3 });
    expect(s3Service.uploadFile).toHaveBeenCalled();
  });

  it('wraps non-Error download failures', async () => {
    mockedAxios.get.mockRejectedValue('boom');
    const question = makeQuestion({
      explanation: {
        en: 'e',
        ml: null,
        image: pendingImage('https://cdn.example/x.jpg'),
      },
    });
    await expect(
      service.materializeQuestionImages(question, { questionNumber: 1 }),
    ).rejects.toThrow(/Unknown download error/);
  });

  it('clearSessionCache forces a re-download', async () => {
    const url = 'https://cdn.mathpix.com/once.gif';
    const question = makeQuestion({
      explanation: {
        en: 'e',
        ml: null,
        image: pendingImage(url),
      },
    });

    await service.materializeQuestionImages(question, { questionNumber: 1 });
    service.clearSessionCache();
    await service.materializeQuestionImages(question, { questionNumber: 1 });
    expect(s3Service.uploadFile).toHaveBeenCalledTimes(2);
  });
});
