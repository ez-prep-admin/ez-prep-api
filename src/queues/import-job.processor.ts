import { UnrecoverableError } from 'bullmq';
import {
  IMPORT_ENRICH_QUEUE,
  IMPORT_PARSE_QUEUE,
} from '../redis/redis.constants';
import {
  describeSchemaIssues,
  EnrichJobPayload,
  enrichJobSchema,
  ParseJobPayload,
  parseJobSchema,
} from './import-job.payload';

export interface ImportJobHandlers {
  enrich(payload: EnrichJobPayload): Promise<void>;
  parse(payload: ParseJobPayload): Promise<void>;
}

export interface ImportQueueJob {
  id?: string;
  name: string;
  data: unknown;
}

export async function processImportJob(
  job: ImportQueueJob,
  handlers: ImportJobHandlers,
): Promise<void> {
  if (job.name === IMPORT_ENRICH_QUEUE) {
    const parsed = enrichJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(
        `Invalid import-enrich job ${job.id ?? 'unknown'}: ${describeSchemaIssues(parsed.error)}`,
      );
    }
    await handlers.enrich(parsed.data);
    return;
  }

  if (job.name === IMPORT_PARSE_QUEUE) {
    const parsed = parseJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(
        `Invalid import-parse job ${job.id ?? 'unknown'}: ${describeSchemaIssues(parsed.error)}`,
      );
    }
    await handlers.parse(parsed.data);
    return;
  }

  throw new UnrecoverableError(`Unknown import job "${job.name}"`);
}
