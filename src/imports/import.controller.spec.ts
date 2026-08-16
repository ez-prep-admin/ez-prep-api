import { Test, TestingModule } from '@nestjs/testing';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ImportController', () => {
  let controller: ImportController;
  const importService = {
    persistQuestions: jest.fn(),
    uploadQuestionPdf: jest.fn(),
    startParsePdfUpload: jest.fn(),
    parseUploadMarkdown: jest.fn(),
    startEnrichUpload: jest.fn(),
    enrichQuestions: jest.fn(),
    getCachedEnrichment: jest.fn(),
    listFailedQuestions: jest.fn(),
    getFailedQuestion: jest.fn(),
    importFailedQuestion: jest.fn(),
    deleteFailedQuestion: jest.fn(),
    getUploadDetails: jest.fn(),
    listUploads: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [{ provide: ImportService, useValue: importService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ImportController);
  });

  const user = { id: 'user-1' } as never;

  it('persistQuestions wraps the service result', async () => {
    importService.persistQuestions.mockResolvedValue({
      summary: 'done',
      saved: [],
    });
    const result = await controller.persistQuestions('upload-1');
    expect(result.message).toBe('done');
    expect(result.data).toMatchObject({ saved: [] });
  });

  it('uploadQuestionPdf forwards the file, dto, and user id', async () => {
    const file = { originalname: 'p.pdf' } as Express.Multer.File;
    const dto = { title: 'Paper' };
    importService.uploadQuestionPdf.mockResolvedValue({ uploadId: 'u1' });

    const result = await controller.uploadQuestionPdf(file, dto, user);

    expect(importService.uploadQuestionPdf).toHaveBeenCalledWith(
      file,
      dto,
      'user-1',
    );
    expect(result.message).toContain('uploaded successfully');
  });

  it('parseQuestionPdf starts an async parse job', async () => {
    importService.startParsePdfUpload.mockResolvedValue({
      message: 'started',
      uploadId: 'u1',
      status: 'parsing',
    });
    const result = await controller.parseQuestionPdf('u1', {
      maxPollingAttempts: 10,
    });
    expect(result.message).toBe('started');
  });

  it('parseUploadMarkdown returns parser output', async () => {
    importService.parseUploadMarkdown.mockResolvedValue({
      parserName: 'adaptive',
    });
    const result = await controller.parseUploadMarkdown('u1');
    expect(result.data.parserName).toBe('adaptive');
  });

  it('enrichUpload and enrichQuestions delegate to the service', async () => {
    importService.startEnrichUpload.mockResolvedValue({
      message: 'enriching',
      status: 'processing',
    });
    importService.enrichQuestions.mockResolvedValue({
      summary: 'ok',
      questions: [],
    });

    await expect(controller.enrichUpload('u1', {})).resolves.toMatchObject({
      message: 'enriching',
    });
    await expect(
      controller.enrichQuestions({} as never),
    ).resolves.toMatchObject({
      message: 'ok',
    });
  });

  it('cached enrichment, uploads, and failed-question endpoints', async () => {
    importService.getCachedEnrichment.mockResolvedValue({ status: 'enriched' });
    importService.listFailedQuestions.mockResolvedValue({ items: [] });
    importService.getFailedQuestion.mockResolvedValue({ id: 'f1' });
    importService.importFailedQuestion.mockResolvedValue({
      questionId: 'q1',
      failedQuestionId: 'f1',
    });
    importService.deleteFailedQuestion.mockResolvedValue({
      failedQuestionId: 'f1',
      uploadId: 'u1',
      questionNumber: 1,
    });
    importService.getUploadDetails.mockResolvedValue({ id: 'u1' });
    importService.listUploads.mockResolvedValue({ uploads: [] });

    await expect(controller.getCachedEnrichment('u1')).resolves.toMatchObject({
      data: { status: 'enriched' },
    });
    await expect(
      controller.listFailedQuestions(1, 10, 's', 't', 'e'),
    ).resolves.toMatchObject({ data: { items: [] } });
    expect(importService.listFailedQuestions).toHaveBeenCalledWith(1, 10, {
      subjectId: 's',
      topicId: 't',
      examId: 'e',
    });
    await expect(controller.getFailedQuestion('f1')).resolves.toMatchObject({
      data: { id: 'f1' },
    });
    await expect(
      controller.importFailedQuestion('f1', {
        question: { stem: 'x' },
      } as never),
    ).resolves.toMatchObject({
      data: { questionId: 'q1' },
    });
    await expect(controller.deleteFailedQuestion('f1')).resolves.toMatchObject({
      data: { failedQuestionId: 'f1' },
    });
    await expect(controller.getUploadDetails('u1')).resolves.toMatchObject({
      data: { id: 'u1' },
    });
    await expect(
      controller.listUploads({ page: 1 } as never),
    ).resolves.toMatchObject({
      data: { uploads: [] },
    });
  });

  it('listFailedQuestions defaults page and limit', async () => {
    importService.listFailedQuestions.mockResolvedValue({ items: [] });
    await controller.listFailedQuestions();
    expect(importService.listFailedQuestions).toHaveBeenCalledWith(1, 10, {
      subjectId: undefined,
      topicId: undefined,
      examId: undefined,
    });
  });
});
