import { UnrecoverableError } from 'bullmq';
import {
  IMPORT_ENRICH_QUEUE,
  IMPORT_PARSE_QUEUE,
} from '../redis/redis.constants';
import { processImportJob } from './import-job.processor';

const UPLOAD_ID = '507f1f77bcf86cd799439011';

describe('processImportJob', () => {
  const handlers = {
    enrich: jest.fn().mockResolvedValue(undefined),
    parse: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs a valid enrich or parse payload', async () => {
    await processImportJob(
      {
        id: 'job-1',
        name: IMPORT_ENRICH_QUEUE,
        data: { uploadId: UPLOAD_ID, forceReparse: true },
      },
      handlers,
    );
    await processImportJob(
      {
        name: IMPORT_PARSE_QUEUE,
        data: { uploadId: UPLOAD_ID, maxPollingAttempts: 3 },
      },
      handlers,
    );
    expect(handlers.enrich).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      forceReparse: true,
    });
    expect(handlers.parse).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      maxPollingAttempts: 3,
    });
  });

  it('refuses invalid or unknown jobs without retrying them', async () => {
    await expect(
      processImportJob(
        { name: IMPORT_ENRICH_QUEUE, data: { uploadId: 'x' } },
        handlers,
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(
      processImportJob(
        { id: 'job-2', name: IMPORT_PARSE_QUEUE, data: {} },
        handlers,
      ),
    ).rejects.toThrow(/job-2/);
    await expect(
      processImportJob(
        { name: IMPORT_PARSE_QUEUE, data: { uploadId: 'bad' } },
        handlers,
      ),
    ).rejects.toThrow(/unknown/);
    await expect(
      processImportJob({ name: 'pdf-processing', data: {} }, handlers),
    ).rejects.toThrow(/Unknown import job/);
    expect(handlers.enrich).not.toHaveBeenCalled();
    expect(handlers.parse).not.toHaveBeenCalled();
  });

  it('propagates worker failures so BullMQ can retry them', async () => {
    handlers.enrich.mockRejectedValueOnce(new Error('deepseek down'));
    await expect(
      processImportJob(
        {
          name: IMPORT_ENRICH_QUEUE,
          data: { uploadId: UPLOAD_ID },
        },
        handlers,
      ),
    ).rejects.toThrow('deepseek down');
  });
});
