import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ImportService } from './import.service';
import { DocumentParserFactory } from './parser/factories/document-parser.factory';
import { AdaptiveParserStrategy } from './parser/strategies/adaptive-parser.strategy';
import { DeepseekService } from './llm/deepseek.service';
import { AiOutputValidator, AiOutputValidationError } from './validators/ai-output.validator';
import { BusinessValidator, BusinessValidationError } from './validators/business.validator';
import { QuestionMapper } from './mapper/question.mapper';
import { QuestionChunkerService } from './chunking/question-chunker.service';
import {
  PersistQuestionValidator,
  PersistQuestionValidationError,
} from './validators/persist-question.validator';
import { QuestionPersistenceService } from './persistence/question-persistence.service';
import { FailedQuestionService } from './persistence/failed-question.service';
import {
  ImportImageStorageService,
  ImportImageMaterializeError,
} from './images/import-image-storage.service';
import { S3Service } from '../aws/s3/s3.service';
import { MathpixService } from '../integrations/mathpix/mathpix.service';
import { QuestionUpload } from './schemas/question-upload.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import {
  ImportQuestion,
  PDF_IMPORT_QUESTION_SOURCE,
} from './types/import-question';
import { MATHPIX_PENDING_BUCKET } from './types/import-image-metadata';
import { MatchedQuestion } from './types/matched-question';

const UPLOAD_ID = '507f1f77bcf86cd799439011';
const SUBJECT_ID = '507f1f77bcf86cd799439012';
const TOPIC_ID = '507f1f77bcf86cd799439013';
const FAILED_ID = '507f1f77bcf86cd799439014';

const matched: MatchedQuestion[] = [
  { index: 0, number: 1, question: 'Q1 stem', solution: 'A1' },
];

function importQuestion(partial: Partial<ImportQuestion> = {}): ImportQuestion {
  return {
    questionText: {
      en: { text: 'Q1 stem', image: null },
      ml: { text: null, image: null },
    },
    optionType: 'text',
    options: [{ id: 'a', type: 'text', en: 'A', ml: null }],
    explanation: { en: 'A1', ml: null, image: null },
    correctAnswer: 'a',
    subject: SUBJECT_ID,
    topic: TOPIC_ID,
    exams: [],
    difficultyLevel: 'easy',
    isActive: true,
    isDeleted: false,
    source: PDF_IMPORT_QUESTION_SOURCE,
    ...partial,
  };
}

function makeUpload(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(UPLOAD_ID),
    subject: new Types.ObjectId(SUBJECT_ID),
    topic: new Types.ObjectId(TOPIC_ID),
    exams: [],
    markdownS3Key: 'md/key.md',
    s3Key: 'pdf/key.pdf',
    s3Bucket: 'uploads',
    filename: 'paper.pdf',
    title: 'Paper',
    status: 'uploaded',
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn().mockReturnValue({ id: UPLOAD_ID }),
    ...overrides,
  };
}

function subjectQuery(name = 'Physics') {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ name }),
      }),
    }),
  };
}

describe('ImportService', () => {
  let service: ImportService;

  const documentParserFactory = {
    getParser: jest.fn(),
  };
  const adaptiveParser = {
    clearCache: jest.fn(),
    seedStructure: jest.fn(),
    getCachedStructure: jest.fn().mockReturnValue(null),
  };
  const deepseekService = {
    extractQuestionsBatch: jest.fn(),
  };
  const aiOutputValidator = {
    validateBatch: jest.fn(),
  };
  const businessValidator = {
    validate: jest.fn().mockImplementation(output => output),
  };
  const questionMapper = {
    map: jest.fn().mockReturnValue(importQuestion()),
  };
  const questionChunker = {
    chunkByTokenLimit: jest.fn(),
    chunk: jest.fn(),
    estimateTotalTokens: jest.fn().mockReturnValue(100),
    getChunkingStats: jest.fn().mockReturnValue({
      estimatedChunks: 1,
      totalTokens: 100,
      avgQuestionsPerChunk: 1,
      avgTokensPerChunk: 100,
      chunks: [],
    }),
  };
  const persistQuestionValidator = {
    validateQuestion: jest.fn(),
  };
  const questionPersistenceService = {
    saveOne: jest.fn(),
  };
  const failedQuestionService = {
    replaceForUpload: jest.fn(),
    listByUpload: jest.fn().mockResolvedValue([]),
    listPaginated: jest.fn(),
    findByIdOrThrow: jest.fn(),
    deleteByIdOrThrow: jest.fn(),
    deleteById: jest.fn(),
    countByUpload: jest.fn().mockResolvedValue(0),
  };
  const importImageStorage = {
    clearSessionCache: jest.fn(),
    materializeQuestionImages: jest.fn(async (q: ImportQuestion) => q),
  };
  const s3Service = {
    generateQuestionUploadKey: jest.fn().mockReturnValue('pdf/key.pdf'),
    generateQuestionMarkdownKey: jest.fn().mockReturnValue('md/key.md'),
    uploadFile: jest.fn(),
    getPresignedUrl: jest.fn(),
    downloadFile: jest.fn(),
  };
  const mathpixService = {
    convertPdfToMarkdown: jest.fn(),
  };
  const questionUploadModel: any = jest.fn();
  const subjectModel: any = {
    findById: jest.fn().mockReturnValue(subjectQuery()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    questionUploadModel.findById = jest.fn();
    questionUploadModel.find = jest.fn();
    questionUploadModel.updateOne = jest.fn().mockResolvedValue({});
    questionUploadModel.countDocuments = jest.fn().mockResolvedValue(0);
    subjectModel.findById.mockReturnValue(subjectQuery());
    questionChunker.chunkByTokenLimit.mockImplementation((questions: MatchedQuestion[]) => [
      { chunkIndex: 0, questions, estimatedTokens: 50 },
    ]);
    questionChunker.chunk.mockImplementation((questions: MatchedQuestion[]) => [
      { chunkIndex: 0, questions, estimatedTokens: 50 },
    ]);
    deepseekService.extractQuestionsBatch.mockResolvedValue({
      content: '{"questions":[]}',
      finishReason: 'stop',
      completionTokens: 10,
    });
    aiOutputValidator.validateBatch.mockReturnValue([
      {
        number: 1,
        questionText: 'Q1 stem',
        options: [
          { label: 'a', text: 'A' },
          { label: 'b', text: 'B' },
          { label: 'c', text: 'C' },
          { label: 'd', text: 'D' },
        ],
        correctAnswer: 'a',
        explanation: 'A1',
        difficultyLevel: 'easy',
      },
    ]);
    persistQuestionValidator.validateQuestion.mockImplementation(async q => q);
    questionPersistenceService.saveOne.mockResolvedValue({
      _id: new Types.ObjectId(),
    });
    questionMapper.map.mockReturnValue(importQuestion());
    importImageStorage.materializeQuestionImages.mockImplementation(
      async (q: ImportQuestion) => q,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: DocumentParserFactory, useValue: documentParserFactory },
        { provide: AdaptiveParserStrategy, useValue: adaptiveParser },
        { provide: DeepseekService, useValue: deepseekService },
        { provide: AiOutputValidator, useValue: aiOutputValidator },
        { provide: BusinessValidator, useValue: businessValidator },
        { provide: QuestionMapper, useValue: questionMapper },
        { provide: QuestionChunkerService, useValue: questionChunker },
        { provide: PersistQuestionValidator, useValue: persistQuestionValidator },
        { provide: QuestionPersistenceService, useValue: questionPersistenceService },
        { provide: FailedQuestionService, useValue: failedQuestionService },
        { provide: ImportImageStorageService, useValue: importImageStorage },
        { provide: S3Service, useValue: s3Service },
        { provide: MathpixService, useValue: mathpixService },
        { provide: getModelToken(QuestionUpload.name), useValue: questionUploadModel },
        { provide: getModelToken(Subject.name), useValue: subjectModel },
      ],
    }).compile();

    service = module.get(ImportService);
  });

  describe('parseMarkdown', () => {
    it('returns matched questions and stats', async () => {
      documentParserFactory.getParser.mockReturnValue({
        configuration: { parserName: 'adaptive' },
        parseWithResult: jest.fn().mockResolvedValue({
          data: matched,
          warnings: [],
          errors: [],
        }),
      });

      const result = await service.parseMarkdown('# md', {
        cachedStructure: { detectedFormat: 'x' } as never,
      });

      expect(adaptiveParser.seedStructure).toHaveBeenCalled();
      expect(result.stats.questionCount).toBe(1);
      expect(result.stats.matchedCount).toBe(1);
    });

    it('throws when parsing yields only errors', async () => {
      documentParserFactory.getParser.mockReturnValue({
        configuration: { parserName: 'adaptive' },
        parseWithResult: jest.fn().mockResolvedValue({
          data: [],
          warnings: [],
          errors: [{ code: 'X', message: 'fail' }],
        }),
      });

      await expect(service.parseMarkdown('bad')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('parseUploadMarkdown', () => {
    it('requires markdown S3 key', async () => {
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ markdownS3Key: undefined }),
      );
      await expect(service.parseUploadMarkdown(UPLOAD_ID)).rejects.toThrow(
        /Markdown not available/,
      );
    });

    it('parses markdown from S3 and caches the result', async () => {
      const upload = makeUpload();
      questionUploadModel.findById.mockResolvedValue(upload);
      s3Service.downloadFile.mockResolvedValue({
        body: Buffer.from('1. Q'),
      });
      documentParserFactory.getParser.mockReturnValue({
        configuration: { parserName: 'adaptive' },
        parseWithResult: jest.fn().mockResolvedValue({
          data: matched,
          warnings: [],
          errors: [],
        }),
      });

      const result = await service.parseUploadMarkdown(UPLOAD_ID);

      expect(result.parserName).toBe('adaptive');
      expect(upload.save).toHaveBeenCalled();
      expect(result.chunkingPreview.estimatedChunks).toBe(1);
    });
  });

  describe('enrichQuestions', () => {
    it('requires matchedQuestions and mapper ids', async () => {
      await expect(service.enrichQuestions({})).rejects.toThrow(
        /matchedQuestions is required/,
      );
      await expect(
        service.enrichQuestions({ matchedQuestions: matched } as never),
      ).rejects.toThrow(/subjectId and topicId are required/);
    });

    it('enriches a sequential chunk successfully', async () => {
      const result = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        examIds: [],
        adaptiveChunking: true,
        useParallel: false,
        maxRetries: 1,
      });

      expect(result.questions).toHaveLength(1);
      expect(result.stats.success).toBe(1);
      expect(result.summary).toContain('all 1');
    });

    it('records missing LLM questions as rejected', async () => {
      aiOutputValidator.validateBatch.mockReturnValue([]);
      const result = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        maxRetries: 1,
      });
      expect(result.rejected[0].message).toMatch(/missing from batch/);
      expect(result.summary).toContain('Enrichment failed');
    });

    it('retries then fails the chunk', async () => {
      deepseekService.extractQuestionsBatch.mockRejectedValue(
        new Error('llm down'),
      );
      const result = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        maxRetries: 1,
      });
      expect(result.rejected[0].stage).toBe('llm');
    });

    it('maps business, zod, and image errors to stages', async () => {
      questionMapper.map.mockImplementation(() => {
        throw new BusinessValidationError('bad', ['dup']);
      });
      const business = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        maxRetries: 1,
      });
      expect(business.rejected[0].stage).toBe('business');

      questionMapper.map.mockImplementation(() => {
        throw new AiOutputValidationError('zod', ['x']);
      });
      const zod = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        maxRetries: 1,
      });
      expect(zod.rejected[0].stage).toBe('zod');

      questionMapper.map.mockReturnValue(importQuestion());
      importImageStorage.materializeQuestionImages.mockRejectedValue(
        new ImportImageMaterializeError('img'),
      );
      const image = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        maxRetries: 1,
      });
      expect(image.rejected[0].stage).toBe('image');
      expect(image.summary).toContain('1 of 1');
    });

    it('uses fixed chunking and parallel mode', async () => {
      const result = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        adaptiveChunking: false,
        useParallel: true,
        maxConcurrentChunks: 1,
        maxRetries: 1,
      });
      expect(questionChunker.chunk).toHaveBeenCalled();
      expect(result.chunking.adaptiveChunking).toBe(false);
    });

    it('captures rejected promises in parallel processing', async () => {
      jest
        .spyOn(
          service as unknown as {
            processChunkWithRetry: () => Promise<unknown>;
          },
          'processChunkWithRetry',
        )
        .mockRejectedValueOnce(new Error('chunk exploded'));

      const result = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        useParallel: true,
        maxRetries: 1,
      });
      expect(result.rejected.length).toBeGreaterThan(0);
    });
  });

  describe('startEnrichUpload', () => {
    it('rejects invalid ids, missing markdown, missing metadata, and in-flight jobs', async () => {
      await expect(service.startEnrichUpload('bad')).rejects.toThrow(
        /Invalid upload ID/,
      );

      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ status: 'processing' }),
      );
      await expect(service.startEnrichUpload(UPLOAD_ID)).rejects.toThrow(
        ConflictException,
      );

      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ markdownS3Key: undefined, status: 'parsed' }),
      );
      await expect(service.startEnrichUpload(UPLOAD_ID)).rejects.toThrow(
        /Markdown not available/,
      );

      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ subject: undefined, status: 'parsed' }),
      );
      await expect(service.startEnrichUpload(UPLOAD_ID)).rejects.toThrow(
        /missing subjectId/,
      );
    });

    it('accepts a job and completes enrichment in the background', async () => {
      const upload = makeUpload({
        status: 'parsed',
        matchedQuestionsCache: matched,
      });
      questionUploadModel.findById.mockResolvedValue(upload);

      const accepted = await service.startEnrichUpload(UPLOAD_ID, {});
      expect(accepted.status).toBe('processing');

      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(failedQuestionService.replaceForUpload).toHaveBeenCalled();
    });
  });

  describe('persistQuestions', () => {
    it('requires cached enriched questions and enriched status', async () => {
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ enrichedQuestions: [], status: 'enriched' }),
      );
      await expect(service.persistQuestions(UPLOAD_ID)).rejects.toThrow(
        /No enriched questions/,
      );

      questionUploadModel.findById.mockResolvedValue(
        makeUpload({
          enrichedQuestions: [importQuestion()],
          status: 'parsed',
        }),
      );
      await expect(service.persistQuestions(UPLOAD_ID)).rejects.toThrow(
        /must be in enriched status/,
      );
    });

    it('saves questions and finalizes the upload', async () => {
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({
          status: 'enriched',
          enrichedQuestions: [importQuestion()],
        }),
      );

      const result = await service.persistQuestions(UPLOAD_ID);

      expect(result.stats.saved).toBe(1);
      expect(result.uploadStatus).toBe('completed');
      expect(result.summary).toContain('Import complete');
      expect(questionUploadModel.updateOne).toHaveBeenCalled();
    });

    it('keeps remaining cache when some questions fail', async () => {
      persistQuestionValidator.validateQuestion.mockRejectedValueOnce(
        new PersistQuestionValidationError('invalid', ['x']),
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({
          status: 'enriched',
          enrichedQuestions: [importQuestion(), importQuestion()],
        }),
      );

      const result = await service.persistQuestions(UPLOAD_ID);
      expect(result.stats.failed).toBe(1);
      expect(result.stats.saved).toBe(1);
      expect(result.summary).toContain('partially complete');
    });

    it('rejects concurrent persist jobs', async () => {
      persistQuestionValidator.validateQuestion.mockImplementation(
        () => new Promise(() => undefined),
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({
          status: 'enriched',
          enrichedQuestions: [importQuestion()],
        }),
      );

      void service.persistQuestions(UPLOAD_ID);
      await Promise.resolve();
      await expect(service.persistQuestions(UPLOAD_ID)).rejects.toThrow(
        /already in progress/,
      );
    });

    it('materializes pending images before persist', async () => {
      const pending = importQuestion({
        questionText: {
          en: {
            text: 'q',
            image: {
              key: 'p',
              bucket: MATHPIX_PENDING_BUCKET,
              region: 'external',
              url: 'https://x/a.png',
            },
          },
          ml: { text: null, image: null },
        },
      });
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ status: 'enriched', enrichedQuestions: [pending] }),
      );

      await service.persistQuestions(UPLOAD_ID);
      expect(importImageStorage.materializeQuestionImages).toHaveBeenCalled();
    });
  });

  describe('failed questions and cached enrichment', () => {
    const failedDoc = {
      uploadId: new Types.ObjectId(UPLOAD_ID),
      questionNumber: 1,
      failureStage: 'llm',
      failureMessage: 'nope',
      matchedQuestion: matched[0],
      questionDraft: importQuestion(),
      createdAt: new Date(),
      updatedAt: new Date(),
      toObject: jest.fn().mockReturnValue({ id: FAILED_ID }),
    };

    it('getCachedEnrichment requires a cached result', async () => {
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ enrichedAt: undefined, enrichedQuestions: [] }),
      );
      await expect(service.getCachedEnrichment(UPLOAD_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('getCachedEnrichment returns questions and rejected items', async () => {
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({
          enrichedAt: new Date(),
          enrichedQuestions: [importQuestion()],
          status: 'enriched',
        }),
      );
      failedQuestionService.listByUpload.mockResolvedValue([failedDoc]);

      const result = await service.getCachedEnrichment(UPLOAD_ID);
      expect(result.questions).toHaveLength(1);
      expect(result.rejected[0].id).toBe(FAILED_ID);
    });

    it('listFailedQuestions maps metadata from uploads', async () => {
      failedQuestionService.listPaginated.mockResolvedValue({
        docs: [failedDoc],
        total: 1,
        page: 1,
        limit: 10,
      });
      questionUploadModel.find.mockResolvedValue([makeUpload()]);

      const result = await service.listFailedQuestions(1, 10, {
        subjectId: SUBJECT_ID,
      });
      expect(result.items).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('getFailedQuestion, deleteFailedQuestion, and importFailedQuestion', async () => {
      failedQuestionService.findByIdOrThrow.mockResolvedValue(failedDoc);
      questionUploadModel.findById.mockResolvedValue(makeUpload());
      await expect(service.getFailedQuestion(FAILED_ID)).resolves.toMatchObject({
        questionNumber: 1,
      });

      failedQuestionService.deleteByIdOrThrow.mockResolvedValue(failedDoc);
      await expect(service.deleteFailedQuestion(FAILED_ID)).resolves.toEqual({
        failedQuestionId: FAILED_ID,
        uploadId: UPLOAD_ID,
        questionNumber: 1,
      });

      questionPersistenceService.saveOne.mockResolvedValue({
        _id: new Types.ObjectId(),
      });
      const imported = await service.importFailedQuestion(
        FAILED_ID,
        importQuestion(),
      );
      expect(imported.failedQuestionId).toBe(FAILED_ID);
      expect(failedQuestionService.deleteById).toHaveBeenCalled();
    });

    it('importFailedQuestion maps validation errors to BadRequest', async () => {
      failedQuestionService.findByIdOrThrow.mockResolvedValue(failedDoc);
      persistQuestionValidator.validateQuestion.mockRejectedValue(
        new PersistQuestionValidationError('bad', ['x']),
      );
      await expect(
        service.importFailedQuestion(FAILED_ID, importQuestion()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploads', () => {
    it('uploadQuestionPdf rejects empty files and uploads to S3', async () => {
      await expect(
        service.uploadQuestionPdf(
          { buffer: Buffer.alloc(0), originalname: 'a.pdf' } as Express.Multer.File,
          {},
        ),
      ).rejects.toThrow(/empty/);

      s3Service.uploadFile.mockResolvedValue({
        key: 'pdf/key.pdf',
        bucket: 'uploads',
        region: 'ap-south-1',
        size: 12,
        contentType: 'application/pdf',
        etag: 'etag',
      });
      const instance = makeUpload();
      questionUploadModel.mockImplementation(() => instance);

      const file = {
        buffer: Buffer.from('%PDF'),
        originalname: 'paper.pdf',
        size: 4,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const result = await service.uploadQuestionPdf(file, {
        title: 'NEET',
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        examIds: [SUBJECT_ID],
        metadata: { year: '2024' },
      }, SUBJECT_ID);

      expect(result.title).toBe('Paper');
      expect(result.status).toBe('uploaded');
    });

    it('getUploadDetails and listUploads', async () => {
      questionUploadModel.findById.mockResolvedValue(makeUpload({ status: 'parsed' }));
      const details = await service.getUploadDetails(UPLOAD_ID);
      expect(details.id).toBe(UPLOAD_ID);

      const upload = makeUpload({ status: 'parsed' });
      questionUploadModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([upload]),
            }),
          }),
        }),
      });
      questionUploadModel.countDocuments.mockResolvedValue(1);

      const list = await service.listUploads({
        page: 1,
        limit: 10,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        status: 'parsed',
        search: 'paper',
      } as never);
      expect(list.uploads).toHaveLength(1);
      expect(list.pagination.total).toBe(1);
    });

    it('getMarkdownContent downloads from S3', async () => {
      await expect(service.getMarkdownContent('bad')).rejects.toThrow(
        BadRequestException,
      );
      questionUploadModel.findById.mockResolvedValue(null);
      await expect(service.getMarkdownContent(UPLOAD_ID)).rejects.toThrow(
        NotFoundException,
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ markdownS3Key: undefined }),
      );
      await expect(service.getMarkdownContent(UPLOAD_ID)).rejects.toThrow(
        /not yet parsed/,
      );

      questionUploadModel.findById.mockResolvedValue(makeUpload());
      s3Service.downloadFile.mockResolvedValue({ body: Buffer.from('# md') });
      await expect(service.getMarkdownContent(UPLOAD_ID)).resolves.toBe('# md');
    });
  });

  describe('startParsePdfUpload', () => {
    it('rejects invalid, missing, parsing, and already-parsed uploads', async () => {
      await expect(service.startParsePdfUpload('nope')).rejects.toThrow(
        /Invalid upload ID/,
      );
      questionUploadModel.findById.mockResolvedValue(null);
      await expect(service.startParsePdfUpload(UPLOAD_ID)).rejects.toThrow(
        NotFoundException,
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ status: 'parsing' }),
      );
      await expect(service.startParsePdfUpload(UPLOAD_ID)).rejects.toThrow(
        ConflictException,
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ status: 'parsed' }),
      );
      await expect(service.startParsePdfUpload(UPLOAD_ID)).rejects.toThrow(
        /already been parsed/,
      );
    });

    it('accepts a parse job and converts via Mathpix', async () => {
      const upload = makeUpload({ status: 'uploaded' });
      questionUploadModel.findById.mockResolvedValue(upload);
      s3Service.getPresignedUrl.mockResolvedValue({
        url: 'https://s3/presigned',
        expiresAt: new Date(),
      });
      mathpixService.convertPdfToMarkdown.mockResolvedValue({
        pdfId: 'mx-1',
        markdown: '# paper',
        processingTimeMs: 10,
      });
      s3Service.uploadFile.mockResolvedValue({ key: 'md/key.md' });

      const accepted = await service.startParsePdfUpload(UPLOAD_ID, {
        maxPollingAttempts: 2,
        pollingIntervalMs: 1,
      });
      expect(accepted.status).toBe('parsing');

      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(mathpixService.convertPdfToMarkdown).toHaveBeenCalled();
    });
  });

  describe('coverage branches', () => {
    it('reparses when cache is missing or forceReparse is set', async () => {
      const upload = makeUpload({
        status: 'parsed',
        documentStructureCache: { detectedFormat: 'x' },
      });
      questionUploadModel.findById.mockResolvedValue(upload);
      s3Service.downloadFile.mockResolvedValue({ body: Buffer.from('1. Q') });
      documentParserFactory.getParser.mockReturnValue({
        configuration: { parserName: 'adaptive' },
        parseWithResult: jest.fn().mockResolvedValue({
          data: matched,
          warnings: [],
          errors: [],
        }),
      });

      const accepted = await service.startEnrichUpload(UPLOAD_ID, {
        forceReparse: true,
      });
      expect(accepted.status).toBe('processing');
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(documentParserFactory.getParser).toHaveBeenCalled();
    });

    it('marks background enrich as failed and logs persist errors', async () => {
      const upload = makeUpload({
        status: 'parsed',
        matchedQuestionsCache: matched,
      });
      let calls = 0;
      questionUploadModel.findById.mockImplementation(async () => {
        calls += 1;
        if (calls === 1) return upload;
        if (calls === 2) throw new Error('missing upload');
        throw new Error('cannot persist failure');
      });

      await service.startEnrichUpload(UPLOAD_ID, {});
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
    });

    it('fails enrich when no questions parse', async () => {
      const upload = makeUpload({ status: 'parsed' });
      questionUploadModel.findById.mockResolvedValue(upload);
      s3Service.downloadFile.mockResolvedValue({ body: Buffer.from('empty') });
      documentParserFactory.getParser.mockReturnValue({
        configuration: { parserName: 'adaptive' },
        parseWithResult: jest.fn().mockResolvedValue({
          data: [],
          warnings: [],
          errors: [],
        }),
      });

      await service.startEnrichUpload(UPLOAD_ID, {});
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(upload.status).toBe('failed');
    });

    it('fails enrich when every question is rejected', async () => {
      const upload = makeUpload({
        status: 'parsed',
        matchedQuestionsCache: matched,
      });
      questionUploadModel.findById.mockResolvedValue(upload);
      aiOutputValidator.validateBatch.mockReturnValue([]);

      await service.startEnrichUpload(UPLOAD_ID, { maxRetries: 1 });
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(upload.status).toBe('failed');
      expect((upload as { errorMessage?: string }).errorMessage).toMatch(
        /First error|no questions/,
      );
    });

    it('completes enrich with partial rejections and missing exams', async () => {
      const two = [
        { index: 0, number: 1, question: 'Q1', solution: 'A' },
        { index: 1, number: 2, question: 'Q2', solution: 'B' },
      ];
      const upload = makeUpload({
        status: 'parsed',
        matchedQuestionsCache: two,
        exams: undefined,
      });
      questionUploadModel.findById.mockResolvedValue(upload);
      questionChunker.chunkByTokenLimit.mockReturnValue([
        { chunkIndex: 0, questions: two, estimatedTokens: 50 },
      ]);
      aiOutputValidator.validateBatch.mockReturnValue([
        {
          number: 1,
          questionText: 'Q1',
          options: [
            { label: 'a', text: 'A' },
            { label: 'b', text: 'B' },
            { label: 'c', text: 'C' },
            { label: 'd', text: 'D' },
          ],
          correctAnswer: 'a',
          explanation: 'A',
          difficultyLevel: 'easy',
        },
      ]);

      await service.startEnrichUpload(UPLOAD_ID, { maxRetries: 1 });
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(upload.status).toBe('enriched');
    });

    it('splits truncated batches and retries with backoff', async () => {
      jest.useFakeTimers();
      try {
        const two = [
          { index: 0, number: 1, question: 'Q1', solution: 'A' },
          { index: 1, number: 2, question: 'Q2', solution: 'B' },
        ];
        deepseekService.extractQuestionsBatch
          .mockResolvedValueOnce({
            content: '{"questions":[]}',
            finishReason: 'length',
            completionTokens: 1,
          })
          .mockRejectedValueOnce(new Error('temporary'))
          .mockResolvedValue({
            content: '{"questions":[]}',
            finishReason: 'stop',
            completionTokens: 10,
          });

        const pending = service.enrichQuestions({
          matchedQuestions: two,
          subjectId: SUBJECT_ID,
          topicId: TOPIC_ID,
          maxRetries: 2,
        });
        await jest.runAllTimersAsync();
        const result = await pending;
        expect(result.rejected.length).toBeGreaterThan(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('skips unmatched LLM numbers and maps unknown errors', async () => {
      aiOutputValidator.validateBatch.mockReturnValue([
        {
          number: 99,
          questionText: 'ghost',
          options: [
            { label: 'a', text: 'A' },
            { label: 'b', text: 'B' },
            { label: 'c', text: 'C' },
            { label: 'd', text: 'D' },
          ],
          correctAnswer: 'a',
          explanation: 'x',
          difficultyLevel: 'easy',
        },
        {
          number: 1,
          questionText: 'Q1 stem',
          options: [
            { label: 'a', text: 'A' },
            { label: 'b', text: 'B' },
            { label: 'c', text: 'C' },
            { label: 'd', text: 'D' },
          ],
          correctAnswer: 'a',
          explanation: 'A1',
          difficultyLevel: 'easy',
        },
      ]);
      questionMapper.map.mockImplementation(() => {
        throw 'not-an-error';
      });
      const result = await service.enrichQuestions({
        matchedQuestions: matched,
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        maxRetries: 1,
      });
      expect(result.rejected.some(item => item.stage === 'llm')).toBe(true);
    });

    it('maps importFailedQuestion error types', async () => {
      failedQuestionService.findByIdOrThrow.mockRejectedValueOnce(
        new NotFoundException('gone'),
      );
      await expect(service.importFailedQuestion(FAILED_ID, importQuestion())).rejects.toThrow(
        NotFoundException,
      );

      failedQuestionService.findByIdOrThrow.mockRejectedValueOnce(
        new BadRequestException('bad'),
      );
      await expect(service.importFailedQuestion(FAILED_ID, importQuestion())).rejects.toThrow(
        BadRequestException,
      );

      failedQuestionService.findByIdOrThrow.mockResolvedValue({
        uploadId: new Types.ObjectId(UPLOAD_ID),
        questionNumber: 1,
        matchedQuestion: matched[0],
        questionDraft: importQuestion(),
      });
      questionPersistenceService.saveOne.mockRejectedValue('weird');
      await expect(
        service.importFailedQuestion(FAILED_ID, importQuestion()),
      ).rejects.toThrow(BadRequestException);
    });

    it('lists failed questions with incomplete uploads and missing drafts', async () => {
      failedQuestionService.listPaginated.mockResolvedValue({
        docs: [
          {
            uploadId: new Types.ObjectId(UPLOAD_ID),
            questionNumber: 1,
            failureStage: 'llm',
            failureMessage: 'x',
            matchedQuestion: matched[0],
            createdAt: new Date(),
            updatedAt: new Date(),
            toObject: jest.fn().mockReturnValue({ id: FAILED_ID }),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      });
      questionUploadModel.find.mockResolvedValue([
        makeUpload({ subject: undefined, topic: undefined }),
      ]);
      const result = await service.listFailedQuestions(1, 10, {});
      expect(result.items).toHaveLength(1);

      failedQuestionService.listPaginated.mockResolvedValue({
        docs: [],
        total: 0,
        page: 1,
        limit: 10,
      });
      const empty = await service.listFailedQuestions(1, 10, {});
      expect(empty.items).toEqual([]);
    });

    it('persists pending explanation images and all-fail summaries', async () => {
      persistQuestionValidator.validateQuestion.mockRejectedValue(
        new PersistQuestionValidationError('invalid', ['x']),
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({
          status: 'enriched',
          enrichedQuestions: [
            importQuestion({
              explanation: {
                en: 'e',
                ml: null,
                image: null,
                images: [
                  {
                    key: 'p',
                    bucket: MATHPIX_PENDING_BUCKET,
                    region: 'external',
                    url: 'https://x/a.png',
                  },
                ],
              },
            }),
          ],
        }),
      );
      const result = await service.persistQuestions(UPLOAD_ID);
      expect(result.summary).toMatch(/Import failed/);
      expect(result.stats.saved).toBe(0);
    });

    it('throws when an upload is missing', async () => {
      questionUploadModel.findById.mockResolvedValue(null);
      await expect(service.persistQuestions(UPLOAD_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('logs upload-pdf failures', async () => {
      s3Service.uploadFile.mockRejectedValue(new Error('s3 down'));
      await expect(
        service.uploadQuestionPdf(
          {
            buffer: Buffer.from('%PDF'),
            originalname: 'paper.pdf',
            size: 4,
            mimetype: 'application/pdf',
          } as Express.Multer.File,
          {},
        ),
      ).rejects.toThrow(/s3 down/);
    });

    it('persists parse failures in the background', async () => {
      const upload = makeUpload({ status: 'uploaded' });
      questionUploadModel.findById.mockResolvedValue(upload);
      s3Service.getPresignedUrl.mockRejectedValue(new Error('no url'));

      await service.startParsePdfUpload(UPLOAD_ID, { pollingIntervalMs: 1 });
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(upload.status).toBe('failed');
    });

    it('handles missing uploads during background parse persist', async () => {
      const upload = makeUpload({ status: 'uploaded' });
      let n = 0;
      questionUploadModel.findById.mockImplementation(async () => {
        n += 1;
        if (n === 1) return upload;
        if (n === 2) return null;
        throw new Error('save failed');
      });
      s3Service.getPresignedUrl.mockRejectedValue(new Error('no url'));
      await service.startParsePdfUpload(UPLOAD_ID, { pollingIntervalMs: 1 });
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
    });

    it('getUploadDetails validates ids and maps exams', async () => {
      await expect(service.getUploadDetails('nope')).rejects.toThrow(
        /Invalid upload ID/,
      );
      questionUploadModel.findById.mockResolvedValue(null);
      await expect(service.getUploadDetails(UPLOAD_ID)).rejects.toThrow(
        NotFoundException,
      );
      questionUploadModel.findById.mockResolvedValue(
        makeUpload({ exams: [new Types.ObjectId(SUBJECT_ID)] }),
      );
      const details = await service.getUploadDetails(UPLOAD_ID);
      expect(details.examIds).toEqual([SUBJECT_ID]);
    });

    it('listUploads maps exam ids', async () => {
      const upload = makeUpload({
        exams: [new Types.ObjectId(SUBJECT_ID)],
      });
      questionUploadModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([upload]),
            }),
          }),
        }),
      });
      questionUploadModel.countDocuments.mockResolvedValue(1);
      const list = await service.listUploads({ page: 1, limit: 10 } as never);
      expect(list.uploads[0].examIds).toEqual([SUBJECT_ID]);
    });
  });
});
