import { Logger } from '@nestjs/common';
import { Queue, QueueOptions } from 'bullmq';
import { randomUUID } from 'crypto';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import {
  IMPORT_ENRICH_QUEUE,
  IMPORT_PARSE_QUEUE,
} from '../redis/redis.constants';
import { errorMessage } from '../redis/redis-log';
import { queueName } from '../redis/queue-name';
import { waitUntilReady } from '../redis/redis-readiness';
import { RedisSettings } from '../redis/redis.settings';
import {
  EnrichJobPayload,
  ParseJobPayload,
  toEnrichJobPayload,
  toParseJobPayload,
  EnrichJobInput,
  ParseJobInput,
} from './import-job.payload';

export interface ImportJobPublisher {
  enqueueEnrich(uploadId: string, input: EnrichJobInput): Promise<string>;
  enqueueParse(uploadId: string, input: ParseJobInput): Promise<string>;
  getJobState(logicalQueue: string, jobId: string): Promise<string | null>;
  close(): Promise<void>;
}

interface QueueHandle {
  add(
    name: string,
    data: EnrichJobPayload | ParseJobPayload,
    options: { jobId: string },
  ): Promise<{ id?: string }>;
  getJob(
    jobId: string,
  ): Promise<{ getState: () => Promise<string> } | undefined>;
  close(): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): void;
}

export type QueueFactory = (name: string, options: QueueOptions) => QueueHandle;

export class BullImportJobPublisher implements ImportJobPublisher {
  private readonly logger = new Logger(BullImportJobPublisher.name);
  private readonly queues = new Map<string, QueueHandle>();
  private producer?: {
    status: string;
    connect(): Promise<unknown>;
    once(event: 'ready' | 'end', listener: () => void): void;
    off(event: 'ready' | 'end', listener: () => void): void;
  };

  private onEnqueued?: () => Promise<void>;

  constructor(
    private readonly settings: RedisSettings,
    private readonly connections: RedisConnectionRegistry,
    private readonly createQueue: QueueFactory = (name, options) =>
      new Queue(name, options),
  ) {}

  setOnEnqueued(listener: () => Promise<void>): void {
    this.onEnqueued = listener;
  }

  async enqueueEnrich(
    uploadId: string,
    input: EnrichJobInput,
  ): Promise<string> {
    return this.enqueue(
      IMPORT_ENRICH_QUEUE,
      toEnrichJobPayload(uploadId, input),
    );
  }

  async enqueueParse(uploadId: string, input: ParseJobInput): Promise<string> {
    return this.enqueue(IMPORT_PARSE_QUEUE, toParseJobPayload(uploadId, input));
  }

  async getJobState(
    logicalQueue: string,
    jobId: string,
  ): Promise<string | null> {
    const queue = await this.queueFor(logicalQueue);
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }
    return job.getState();
  }

  async close(): Promise<void> {
    const queues = [...this.queues.values()];
    this.queues.clear();
    await Promise.all(
      queues.map(async queue => {
        try {
          await queue.close();
        } catch (error) {
          this.logger.error(
            `Failed to close an import queue: ${errorMessage(error)}`,
          );
        }
      }),
    );
  }

  private async enqueue(
    logicalQueue: string,
    payload: EnrichJobPayload | ParseJobPayload,
  ): Promise<string> {
    const queue = await this.queueFor(logicalQueue);
    const job = await queue.add(logicalQueue, payload, {
      jobId: jobIdFor(logicalQueue, payload.uploadId),
    });
    if (!job.id) {
      throw new Error(`Redis accepted no id for queue ${logicalQueue}`);
    }
    // The HTTP handler must return as soon as Redis has the job.
    // Processing continues on the poller and must not be awaited here.
    const jobId = job.id;
    void Promise.resolve(this.onEnqueued?.()).catch(error => {
      this.logger.error(
        `Import job ${jobId} was queued but its worker did not start: ${errorMessage(error)}`,
      );
    });
    return jobId;
  }

  private async queueFor(logicalQueue: string): Promise<QueueHandle> {
    const name = queueName(this.settings.keyPrefix, logicalQueue);
    const existing = this.queues.get(name);
    if (existing) {
      return existing;
    }

    const producer = this.producerClient();
    await waitUntilReady(producer, this.settings.connectTimeoutMs);
    const queue = this.createQueue(name, {
      connection: producer as QueueOptions['connection'],
      prefix: this.settings.bullPrefix,
      skipWaitingForReady: true,
      defaultJobOptions: {
        attempts: this.settings.attempts,
        backoff: {
          type: 'exponential',
          delay: this.settings.backoffDelayMs,
        },
        removeOnComplete: {
          count: this.settings.removeOnCompleteCount,
          age: this.settings.removeOnCompleteAgeSec,
        },
        removeOnFail: {
          count: this.settings.removeOnFailCount,
          age: this.settings.removeOnFailAgeSec,
        },
      },
    });
    queue.on('error', error => {
      this.logger.error(`Import queue ${name} error: ${errorMessage(error)}`);
    });
    this.queues.set(name, queue);
    return queue;
  }

  private producerClient() {
    if (!this.producer) {
      this.producer = this.connections.create('producer');
    }
    return this.producer;
  }
}

export function createImportJobPublisher(
  settings: RedisSettings,
  connections: RedisConnectionRegistry,
): ImportJobPublisher | null {
  if (!settings.enabled) {
    return null;
  }
  return new BullImportJobPublisher(settings, connections);
}

function jobIdFor(logicalQueue: string, uploadId: string): string {
  return `${logicalQueue}-${uploadId}-${randomUUID()}`;
}
