import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { BullImportJobPublisher } from './bull-import-job.publisher';
import { ImportQueueWorker } from './import-queue.worker';
import { IMPORT_JOB_PUBLISHER } from '../redis/redis.constants';

@Injectable()
export class ImportQueueLifecycle implements OnModuleDestroy {
  constructor(
    @Optional()
    @Inject(IMPORT_JOB_PUBLISHER)
    private readonly publisher: BullImportJobPublisher | null,
    private readonly worker: ImportQueueWorker,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.publisher?.close();
  }
}
