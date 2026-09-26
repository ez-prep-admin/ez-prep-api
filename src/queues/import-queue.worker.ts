import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Worker, WorkerOptions } from 'bullmq';
import { randomUUID } from 'crypto';
import { ImportService } from '../imports/import.service';
import { queueName } from '../redis/queue-name';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import {
  IMPORT_ENRICH_QUEUE,
  IMPORT_PARSE_QUEUE,
  IMPORT_WORKER_FACTORY,
  REDIS_SETTINGS,
} from '../redis/redis.constants';
import { errorMessage } from '../redis/redis-log';
import { waitUntilReady } from '../redis/redis-readiness';
import { RedisSettings } from '../redis/redis.settings';
import { processImportJob } from './import-job.processor';
import { ImportQueueRecovery } from './import-queue.recovery';

export interface ManualJob {
  id?: string;
  name: string;
  data: unknown;
  token?: string;
  extendLock(token: string, duration: number): Promise<number>;
  moveToCompleted(
    returnValue: string,
    token: string,
    fetchNext?: boolean,
  ): Promise<unknown>;
  moveToFailed(
    error: Error,
    token: string,
    fetchNext?: boolean,
  ): Promise<unknown>;
}

/**
 * A worker that never enters BullMQ's blocking wait loop.
 * Upstash answers those waits immediately, which spends the command budget
 * while the queue is empty.
 */
export interface ManualWorker {
  getNextJob(
    token: string,
    options?: { block?: boolean },
  ): Promise<ManualJob | undefined>;
  moveStalledJobsToWait(): Promise<void>;
  close(): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): void;
}

export type ManualWorkerFactory = (
  name: string,
  options: WorkerOptions,
) => ManualWorker;

const defaultManualWorkerFactory: ManualWorkerFactory = (name, options) => {
  const worker = new Worker(name, null, {
    ...options,
    autorun: false,
  });
  return worker as unknown as ManualWorker;
};

/** Lets the worker and the import service construct each other during startup. */
export function resolveImportService(): typeof ImportService {
  return ImportService;
}

interface QueueTarget {
  logicalName: string;
  concurrency: number;
}

@Injectable()
export class ImportQueueWorker implements OnModuleInit {
  private readonly logger = new Logger(ImportQueueWorker.name);
  private readonly workers = new Map<string, ManualWorker>();
  private recoveryTimer?: ReturnType<typeof setInterval>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private connection?: {
    status: string;
    connect(): Promise<unknown>;
    once(event: 'ready' | 'end', listener: () => void): void;
    off(event: 'ready' | 'end', listener: () => void): void;
  };
  private polling = false;
  private pollAgain = false;
  private closed = false;

  constructor(
    @Inject(REDIS_SETTINGS) private readonly settings: RedisSettings,
    private readonly connections: RedisConnectionRegistry,
    private readonly recovery: ImportQueueRecovery,
    @Inject(forwardRef(resolveImportService))
    private readonly importService: ImportService,
    @Optional()
    @Inject(IMPORT_WORKER_FACTORY)
    private readonly createWorker?: ManualWorkerFactory,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.settings.enabled || !this.settings.workerEnabled) {
      return;
    }

    await this.recoverSafely();
    this.recoveryTimer = setInterval(
      () => this.recoverSafely(),
      this.settings.recoveryIntervalMs,
    );
    this.recoveryTimer.unref?.();
    this.pollTimer = setInterval(
      () => this.poll(),
      this.settings.pollIntervalMs,
    );
    this.pollTimer.unref?.();
    await this.poll();
  }

  /** Run one non-blocking fetch now, for example just after a job is queued. */
  async ensureStarted(): Promise<void> {
    if (!this.settings.enabled || !this.settings.workerEnabled || this.closed) {
      return;
    }
    await this.poll();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.clearTimers();
    const workers = [...this.workers.values()];
    this.workers.clear();
    await Promise.all(
      workers.map(async worker => {
        try {
          await worker.close();
        } catch (error) {
          this.logger.error(
            `Failed to close an import worker: ${errorMessage(error)}`,
          );
        }
      }),
    );
  }

  private async poll(): Promise<void> {
    if (this.closed) {
      return;
    }
    if (this.polling) {
      this.pollAgain = true;
      return;
    }

    this.polling = true;
    try {
      do {
        this.pollAgain = false;
        for (const target of this.targets()) {
          if (this.closed) {
            return;
          }
          await this.pollQueue(target);
        }
      } while (this.pollAgain && !this.closed);
    } finally {
      this.polling = false;
    }
  }

  private async pollQueue(target: QueueTarget): Promise<void> {
    let worker: ManualWorker;
    try {
      worker = await this.workerFor(target.logicalName);
      await worker.moveStalledJobsToWait();
    } catch (error) {
      this.logger.error(
        `Import poll failed for ${target.logicalName}: ${errorMessage(error)}`,
      );
      return;
    }

    for (
      let taken = 0;
      taken < target.concurrency && !this.closed;
      taken += 1
    ) {
      let job: ManualJob | undefined;
      const token = randomUUID();
      try {
        job = await worker.getNextJob(token, { block: false });
      } catch (error) {
        this.logger.error(
          `Import poll failed for ${target.logicalName}: ${errorMessage(error)}`,
        );
        return;
      }
      if (!job) {
        return;
      }
      await this.finishJob(job, job.token || token);
    }
  }

  private async finishJob(job: ManualJob, token: string): Promise<void> {
    const renew = setInterval(() => {
      void job.extendLock(token, this.settings.lockDurationMs).catch(error => {
        this.logger.error(
          `Could not extend the lock for import job ${job.id ?? 'unknown'}: ${errorMessage(error)}`,
        );
      });
    }, this.settings.pollIntervalMs);
    renew.unref?.();

    try {
      await processImportJob(job, {
        enrich: payload =>
          this.importService.runEnrichUploadInBackground(
            payload.uploadId,
            payload,
          ),
        parse: payload =>
          this.importService.runParsePdfInBackground(payload.uploadId, payload),
      });
      await job.moveToCompleted('ok', token, false);
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error(errorMessage(error));
      this.logger.error(
        `Import job ${job.id ?? 'unknown'} failed: ${errorMessage(failure)}`,
      );
      try {
        await job.moveToFailed(failure, token, false);
      } catch (moveError) {
        this.logger.error(
          `Could not record failure for import job ${job.id ?? 'unknown'}: ${errorMessage(moveError)}`,
        );
      }
    } finally {
      clearInterval(renew);
    }
  }

  private async workerFor(logicalName: string): Promise<ManualWorker> {
    const existing = this.workers.get(logicalName);
    if (existing) {
      return existing;
    }

    const connection = await this.sharedConnection();
    const name = queueName(this.settings.keyPrefix, logicalName);
    const worker = (this.createWorker ?? defaultManualWorkerFactory)(name, {
      connection,
      prefix: this.settings.bullPrefix,
      autorun: false,
      skipStalledCheck: true,
      skipWaitingForReady: true,
      lockDuration: this.settings.lockDurationMs,
      stalledInterval: this.settings.pollIntervalMs,
      maxStalledCount: this.settings.maxStalledCount,
    });
    worker.on('error', error => {
      this.logger.error(`Import worker ${name} error: ${errorMessage(error)}`);
    });
    this.workers.set(logicalName, worker);
    this.logger.log(
      `Import queue ${name} will be checked every ${this.settings.pollIntervalMs}ms`,
    );
    return worker;
  }

  private async sharedConnection() {
    if (!this.connection) {
      this.connection = this.connections.create('producer');
      try {
        await waitUntilReady(this.connection, this.settings.connectTimeoutMs);
      } catch (error) {
        this.logger.error(
          `Import poller could not reach Redis yet and will retry on the next check: ${errorMessage(error)}`,
        );
      }
    }
    return this.connection;
  }

  private targets(): QueueTarget[] {
    return [
      {
        logicalName: IMPORT_PARSE_QUEUE,
        concurrency: this.settings.parseConcurrency,
      },
      {
        logicalName: IMPORT_ENRICH_QUEUE,
        concurrency: this.settings.enrichConcurrency,
      },
    ];
  }

  private async recoverSafely(): Promise<void> {
    try {
      const recovered = await this.recovery.recoverStaleUploads();
      this.logger.log(
        `Stale upload recovery examined=${recovered.examined} failed=${recovered.failed} spared=${recovered.spared}`,
      );
    } catch (error) {
      this.logger.error(`Stale upload recovery failed: ${errorMessage(error)}`);
    }
  }

  private clearTimers(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}
