import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportModule } from '../imports/import.module';
import {
  QuestionUpload,
  QuestionUploadSchema,
} from '../imports/schemas/question-upload.schema';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import { IMPORT_JOB_PUBLISHER, REDIS_SETTINGS } from '../redis/redis.constants';
import { RedisSettings } from '../redis/redis.settings';
import {
  BullImportJobPublisher,
  createImportJobPublisher,
} from './bull-import-job.publisher';
import { ImportQueueLifecycle } from './import-queue.lifecycle';
import { ImportQueueRecovery } from './import-queue.recovery';
import { ImportQueueWorker } from './import-queue.worker';

@Module({
  imports: [
    forwardRef(() => ImportModule),
    MongooseModule.forFeature([
      { name: QuestionUpload.name, schema: QuestionUploadSchema },
    ]),
  ],
  providers: [
    {
      provide: IMPORT_JOB_PUBLISHER,
      useFactory: (
        settings: RedisSettings,
        connections: RedisConnectionRegistry,
        worker: ImportQueueWorker,
      ) => {
        const publisher = createImportJobPublisher(settings, connections);
        if (publisher instanceof BullImportJobPublisher) {
          publisher.setOnEnqueued(() => worker.ensureStarted());
        }
        return publisher;
      },
      inject: [REDIS_SETTINGS, RedisConnectionRegistry, ImportQueueWorker],
    },
    ImportQueueRecovery,
    ImportQueueWorker,
    ImportQueueLifecycle,
  ],
  exports: [IMPORT_JOB_PUBLISHER],
})
export class ImportQueueModule {}
