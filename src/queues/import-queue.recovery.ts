import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImportJobPublisher } from './bull-import-job.publisher';
import {
  QuestionUpload,
  QuestionUploadDocument,
} from '../imports/schemas/question-upload.schema';
import {
  IMPORT_ENRICH_QUEUE,
  IMPORT_JOB_PUBLISHER,
  IMPORT_PARSE_QUEUE,
  REDIS_SETTINGS,
} from '../redis/redis.constants';
import { errorMessage } from '../redis/redis-log';
import { RedisSettings } from '../redis/redis.settings';

const LIVE_JOB_STATES = new Set([
  'active',
  'waiting',
  'delayed',
  'prioritized',
  'waiting-children',
]);

const BATCH_SIZE = 100;
const MAX_BATCHES = 20;

export interface StaleUploadRecoveryResult {
  examined: number;
  failed: number;
  spared: number;
}

type RecoverableUpload = QuestionUploadDocument & {
  _id: unknown;
  status: string;
  activeJobId?: string;
  activeJobName?: string;
};

@Injectable()
export class ImportQueueRecovery {
  private readonly logger = new Logger(ImportQueueRecovery.name);

  constructor(
    @Inject(REDIS_SETTINGS) private readonly settings: RedisSettings,
    @Inject(IMPORT_JOB_PUBLISHER)
    private readonly publisher: ImportJobPublisher | null,
    @InjectModel(QuestionUpload.name)
    private readonly uploadModel: Model<QuestionUploadDocument>,
  ) {}

  async recoverStaleUploads(
    now = new Date(),
  ): Promise<StaleUploadRecoveryResult> {
    const result: StaleUploadRecoveryResult = {
      examined: 0,
      failed: 0,
      spared: 0,
    };
    if (!this.settings.enabled || !this.publisher) {
      return result;
    }

    const cutoff = new Date(now.getTime() - this.settings.staleJobMs);
    const sparedIds: unknown[] = [];

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const filter: Record<string, unknown> = {
        status: { $in: ['processing', 'parsing'] },
        updatedAt: { $lt: cutoff },
      };
      if (sparedIds.length > 0) {
        filter._id = { $nin: sparedIds };
      }

      const uploads = (await this.uploadModel
        .find(filter)
        .sort({ updatedAt: 1 })
        .limit(BATCH_SIZE)
        .exec()) as RecoverableUpload[];

      if (uploads.length === 0) {
        break;
      }

      for (const upload of uploads) {
        result.examined += 1;
        const live = await this.jobIsLive(upload);
        if (live) {
          result.spared += 1;
          sparedIds.push(upload._id);
          continue;
        }

        const message =
          upload.status === 'parsing'
            ? 'PDF parsing interrupted by server restart'
            : 'Enrichment interrupted by server restart';
        const claimed = await this.uploadModel
          .findOneAndUpdate(
            { _id: upload._id, status: upload.status },
            {
              $set: { status: 'failed', errorMessage: message },
              $unset: { activeJobId: '', activeJobName: '' },
            },
          )
          .exec();
        if (claimed) {
          result.failed += 1;
        }
      }
    }

    return result;
  }

  private async jobIsLive(upload: RecoverableUpload): Promise<boolean> {
    if (!upload.activeJobId || !this.publisher) {
      return false;
    }

    const queues = upload.activeJobName
      ? [upload.activeJobName]
      : [IMPORT_ENRICH_QUEUE, IMPORT_PARSE_QUEUE];

    for (const logicalQueue of queues) {
      try {
        const state = await this.publisher.getJobState(
          logicalQueue,
          upload.activeJobId,
        );
        if (state && LIVE_JOB_STATES.has(state)) {
          return true;
        }
      } catch (error) {
        this.logger.warn(
          `Could not inspect job ${upload.activeJobId} for upload ${String(upload._id)}: ${errorMessage(error)}. Leaving the upload in progress.`,
        );
        return true;
      }
    }

    return false;
  }
}
