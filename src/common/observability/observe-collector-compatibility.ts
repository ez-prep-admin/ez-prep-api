import { Logger } from '@nestjs/common';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * Once the free-plan span allowance is used up, @nestjs/observe deletes the
 * trace array (`t`) and the collector answers 400 because that field must be
 * an array. An empty array is the same "no span tree" payload, and it passes
 * validation. Background work that outlives the HTTP request also tries to
 * close spans after the snapshot is gone; that miss is expected and is not
 * logged.
 */

type TraceEntry = { t?: unknown };

type SnapshotBuffer = {
  _mainThreadBuffer?: {
    snapshots?: TraceEntry[];
    jobs?: TraceEntry[];
  } | null;
};

type TraceRegistry = {
  traceSnapshots: { has(traceId: string): boolean };
};

const logger = new Logger('ObserveCollectorCompatibility');
let installed = false;

export function retainEmptyObserveTraces<T extends TraceEntry>(entry: T): T {
  if (!Array.isArray(entry.t)) {
    entry.t = [];
  }
  return entry;
}

export function wrapObserveSnapshotInsert(
  insert: (this: SnapshotBuffer, snapshot: unknown) => void,
  bucket: 'snapshots' | 'jobs',
): (this: SnapshotBuffer, snapshot: unknown) => void {
  return function (this: SnapshotBuffer, snapshot: unknown) {
    const before = this._mainThreadBuffer?.[bucket]?.length ?? 0;
    insert.call(this, snapshot);
    const entries = this._mainThreadBuffer?.[bucket];
    if (!entries || entries.length <= before) {
      return;
    }
    const added = entries[entries.length - 1];
    if (added) {
      retainEmptyObserveTraces(added);
    }
  };
}

export function wrapObserveTraceEnd(
  endStep: (this: TraceRegistry, ...args: unknown[]) => void,
): (this: TraceRegistry, ...args: unknown[]) => void {
  return function (this: TraceRegistry, ...args: unknown[]) {
    const traceId = args[0];
    if (typeof traceId === 'string' && !this.traceSnapshots.has(traceId)) {
      return;
    }
    return endStep.apply(this, args);
  };
}

export function installObserveCollectorCompatibility(): void {
  if (installed) {
    return;
  }
  installed = true;

  try {
    const require = createRequire(__filename);
    const packageRoot = dirname(require.resolve('@nestjs/observe'));
    const sharedBuffer = require(
      join(packageRoot, 'agent/observe-agent.shared-buffer.js'),
    ) as {
      ObserveAgentSharedBuffer: {
        prototype: SnapshotBuffer & Record<string, unknown>;
      };
    };
    const registry = require(
      join(packageRoot, 'services/operation-trace.registry.js'),
    ) as {
      OperationTraceRegistry: {
        prototype: TraceRegistry & Record<string, unknown>;
      };
    };

    const bufferPrototype = sharedBuffer.ObserveAgentSharedBuffer.prototype;
    bufferPrototype.insertRequestSnapshot = wrapObserveSnapshotInsert(
      bufferPrototype.insertRequestSnapshot as (
        this: SnapshotBuffer,
        snapshot: unknown,
      ) => void,
      'snapshots',
    );
    bufferPrototype.insertJobSnapshot = wrapObserveSnapshotInsert(
      bufferPrototype.insertJobSnapshot as (
        this: SnapshotBuffer,
        snapshot: unknown,
      ) => void,
      'jobs',
    );

    const registryPrototype = registry.OperationTraceRegistry.prototype;
    registryPrototype.internalEndTraceStep = wrapObserveTraceEnd(
      registryPrototype.internalEndTraceStep as (
        this: TraceRegistry,
        ...args: unknown[]
      ) => void,
    );
  } catch (error) {
    logger.warn(
      `Could not adjust Observe payloads for the collector: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}
