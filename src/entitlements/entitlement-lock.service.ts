import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import {
  EntitlementLock,
  EntitlementLockDocument,
} from './schemas/entitlement-lock.schema';

const LEASE_MS = 10_000;
const RETRY_MS = [50, 100, 200, 400, 800];

@Injectable()
export class EntitlementLockService {
  constructor(
    @InjectModel(EntitlementLock.name)
    private readonly lockModel: Model<EntitlementLockDocument>,
  ) {}

  async withLock<T>(
    userId: string,
    productId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const holder = await this.acquire(userId, productId);
    try {
      return await work();
    } finally {
      await this.release(userId, productId, holder);
    }
  }

  private async acquire(userId: string, productId: string): Promise<string> {
    const id = lockId(userId, productId);
    const holder = randomUUID();
    for (let attempt = 0; attempt <= RETRY_MS.length; attempt += 1) {
      const lockedUntil = new Date(Date.now() + LEASE_MS);
      try {
        await this.lockModel.create({ _id: id, holder, lockedUntil });
        return holder;
      } catch (error) {
        if (!isDuplicateKey(error)) {
          throw error;
        }
      }

      const taken = await this.lockModel
        .findOneAndUpdate(
          { _id: id, lockedUntil: { $lt: new Date() } },
          { $set: { holder, lockedUntil } },
          { new: true },
        )
        .exec();
      if (taken) {
        return holder;
      }
      const delay = RETRY_MS[attempt];
      if (delay == null) {
        break;
      }
      await sleep(delay + Math.floor(Math.random() * 20));
    }

    throw new ServiceUnavailableException(
      'Entitlement update is busy. Retry the paid signal.',
    );
  }

  private async release(
    userId: string,
    productId: string,
    holder: string,
  ): Promise<void> {
    await this.lockModel.deleteOne({ _id: lockId(userId, productId), holder });
  }
}

function lockId(userId: string, productId: string): string {
  return `${userId}:${productId}`;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
