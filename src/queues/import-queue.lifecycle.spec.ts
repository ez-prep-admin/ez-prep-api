import { ImportQueueLifecycle } from './import-queue.lifecycle';
import { BullImportJobPublisher } from './bull-import-job.publisher';
import { ImportQueueWorker } from './import-queue.worker';

describe('ImportQueueLifecycle', () => {
  it('closes workers before queues', async () => {
    const order: string[] = [];
    const worker = {
      close: jest.fn(async () => {
        order.push('worker');
      }),
    } as unknown as ImportQueueWorker;
    const publisher = {
      close: jest.fn(async () => {
        order.push('publisher');
      }),
    } as unknown as BullImportJobPublisher;
    const lifecycle = new ImportQueueLifecycle(publisher, worker);
    await lifecycle.onModuleDestroy();
    expect(order).toEqual(['worker', 'publisher']);
  });

  it('closes workers when no publisher was configured', async () => {
    const worker = {
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as ImportQueueWorker;
    const lifecycle = new ImportQueueLifecycle(null, worker);
    await lifecycle.onModuleDestroy();
    expect(worker.close).toHaveBeenCalled();
  });
});
