import { z } from 'zod';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'uploadId must be a Mongo ObjectId');

export const enrichJobSchema = z
  .object({
    uploadId: objectId,
    forceReparse: z.boolean().optional(),
    adaptiveChunking: z.boolean().optional(),
    useParallel: z.boolean().optional(),
    maxRetries: z.number().int().min(1).max(5).optional(),
    maxConcurrentChunks: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const parseJobSchema = z
  .object({
    uploadId: objectId,
    maxPollingAttempts: z.number().int().min(1).max(120).optional(),
    pollingIntervalMs: z.number().int().min(1000).max(30_000).optional(),
  })
  .strict();

export type EnrichJobPayload = z.infer<typeof enrichJobSchema>;
export type ParseJobPayload = z.infer<typeof parseJobSchema>;

export interface EnrichJobInput {
  forceReparse?: boolean;
  adaptiveChunking?: boolean;
  useParallel?: boolean;
  maxRetries?: number;
  maxConcurrentChunks?: number;
}

export interface ParseJobInput {
  maxPollingAttempts?: number;
  pollingIntervalMs?: number;
}

export function toEnrichJobPayload(
  uploadId: string,
  input: EnrichJobInput = {},
): EnrichJobPayload {
  return enrichJobSchema.parse({
    uploadId,
    ...definedFields({
      forceReparse: input.forceReparse,
      adaptiveChunking: input.adaptiveChunking,
      useParallel: input.useParallel,
      maxRetries: input.maxRetries,
      maxConcurrentChunks: input.maxConcurrentChunks,
    }),
  });
}

export function toParseJobPayload(
  uploadId: string,
  input: ParseJobInput = {},
): ParseJobPayload {
  return parseJobSchema.parse({
    uploadId,
    ...definedFields({
      maxPollingAttempts: input.maxPollingAttempts,
      pollingIntervalMs: input.pollingIntervalMs,
    }),
  });
}

export function describeSchemaIssues(error: z.ZodError): string {
  return error.issues
    .map(issue => issue.path.join('.') || 'payload')
    .join(', ');
}

function definedFields<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const entries = Object.entries(input).filter(
    ([, value]) => value !== undefined,
  );
  return Object.fromEntries(entries) as Partial<T>;
}
