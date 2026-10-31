import { Model } from 'mongoose';
import { INSTANCE_CONFIG_ID } from './instance-config.constants';
import { InstanceConfigDocument } from './schemas/instance-config.schema';

/** Fields copied into memory. Seller and tax are intentionally absent. */
export type InstanceOperationsSnapshot = {
  invoicesEnabled?: boolean;
  trustProxyHops?: number;
  maxOpenOrdersPerUser?: number;
  reconciliationEnabled?: boolean;
  reconciliationMinAgeMinutes?: number;
  reconciliationIntervalMs?: number;
  reconciliationBatch?: number;
  reconciliationMaxAttempts?: number;
  webhookRetryWindowMinutes?: number;
  lateCaptureWatchHours?: number;
  refundUnknownWindowMinutes?: number;
};

export type InstanceRedisSnapshot = {
  keyPrefix?: string;
  bullPrefix?: string;
  connectTimeoutMs?: number;
  commandTimeoutMs?: number;
  healthTimeoutMs?: number;
  keepAliveMs?: number;
  parseConcurrency?: number;
  enrichConcurrency?: number;
  attempts?: number;
  backoffDelayMs?: number;
  stalledIntervalMs?: number;
  maxStalledCount?: number;
  lockDurationMs?: number;
  staleJobMs?: number;
  recoveryIntervalMs?: number;
  pollIntervalMs?: number;
  removeOnCompleteCount?: number;
  removeOnCompleteAgeSec?: number;
  removeOnFailCount?: number;
  removeOnFailAgeSec?: number;
};

export type InstanceRuntimeSnapshot = {
  operations: InstanceOperationsSnapshot | null;
  redis: InstanceRedisSnapshot | null;
};

const OPERATION_KEYS = [
  'invoicesEnabled',
  'trustProxyHops',
  'maxOpenOrdersPerUser',
  'reconciliationEnabled',
  'reconciliationMinAgeMinutes',
  'reconciliationIntervalMs',
  'reconciliationBatch',
  'reconciliationMaxAttempts',
  'webhookRetryWindowMinutes',
  'lateCaptureWatchHours',
  'refundUnknownWindowMinutes',
] as const satisfies readonly (keyof InstanceOperationsSnapshot)[];

const REDIS_KEYS = [
  'keyPrefix',
  'bullPrefix',
  'connectTimeoutMs',
  'commandTimeoutMs',
  'healthTimeoutMs',
  'keepAliveMs',
  'parseConcurrency',
  'enrichConcurrency',
  'attempts',
  'backoffDelayMs',
  'stalledIntervalMs',
  'maxStalledCount',
  'lockDurationMs',
  'staleJobMs',
  'recoveryIntervalMs',
  'pollIntervalMs',
  'removeOnCompleteCount',
  'removeOnCompleteAgeSec',
  'removeOnFailCount',
  'removeOnFailAgeSec',
] as const satisfies readonly (keyof InstanceRedisSnapshot)[];

export function toInstanceRuntimeSnapshot(
  doc: {
    operations?: InstanceOperationsSnapshot | null;
    redis?: InstanceRedisSnapshot | null;
  } | null,
): InstanceRuntimeSnapshot {
  if (!doc) {
    return { operations: null, redis: null };
  }
  return {
    operations: pickDefined(doc.operations, OPERATION_KEYS),
    redis: pickDefined(doc.redis, REDIS_KEYS),
  };
}

export async function loadInstanceRuntimeSnapshot(
  model: Model<InstanceConfigDocument>,
): Promise<InstanceRuntimeSnapshot> {
  const doc = await model
    .findById(INSTANCE_CONFIG_ID)
    .select('operations redis')
    .lean()
    .exec();
  return toInstanceRuntimeSnapshot(doc);
}

function pickDefined<T extends object>(
  source: T | null | undefined,
  keys: readonly (keyof T)[],
): Partial<T> | null {
  if (!source) {
    return null;
  }
  const picked: Partial<T> = {};
  let any = false;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      picked[key] = value;
      any = true;
    }
  }
  return any ? picked : null;
}
