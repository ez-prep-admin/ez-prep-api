import { ZodError } from 'zod';
import {
  describeSchemaIssues,
  toEnrichJobPayload,
  toParseJobPayload,
} from './import-job.payload';

const UPLOAD_ID = '507f1f77bcf86cd799439011';

describe('import job payloads', () => {
  it('keeps only fields the worker needs', () => {
    expect(
      toEnrichJobPayload(UPLOAD_ID, {
        forceReparse: true,
        adaptiveChunking: false,
        useParallel: true,
        maxRetries: 2,
        maxConcurrentChunks: 1,
      }),
    ).toEqual({
      uploadId: UPLOAD_ID,
      forceReparse: true,
      adaptiveChunking: false,
      useParallel: true,
      maxRetries: 2,
      maxConcurrentChunks: 1,
    });
    expect(toParseJobPayload(UPLOAD_ID)).toEqual({ uploadId: UPLOAD_ID });
    expect(
      toParseJobPayload(UPLOAD_ID, {
        maxPollingAttempts: 10,
        pollingIntervalMs: 1000,
      }),
    ).toEqual({
      uploadId: UPLOAD_ID,
      maxPollingAttempts: 10,
      pollingIntervalMs: 1000,
    });
  });

  it('rejects payloads that are not safe to execute', () => {
    expect(() => toEnrichJobPayload('nope')).toThrow(ZodError);
    expect(() => toEnrichJobPayload(UPLOAD_ID, { maxRetries: 0 })).toThrow(
      ZodError,
    );
    expect(() =>
      toParseJobPayload(UPLOAD_ID, { pollingIntervalMs: 10 }),
    ).toThrow(ZodError);
    expect(
      describeSchemaIssues(
        new ZodError([
          { code: 'custom', message: 'bad', path: [] },
          { code: 'custom', message: 'also bad', path: ['uploadId'] },
        ]),
      ),
    ).toBe('payload, uploadId');
  });
});
