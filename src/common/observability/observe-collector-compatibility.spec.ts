import {
  retainEmptyObserveTraces,
  wrapObserveSnapshotInsert,
  wrapObserveTraceEnd,
} from './observe-collector-compatibility';

describe('Observe collector compatibility', () => {
  it('replaces a missing trace list with an empty array', () => {
    expect(retainEmptyObserveTraces({})).toEqual({ t: [] });
    expect(retainEmptyObserveTraces({ t: [{ n: 'span' }] }).t).toEqual([
      { n: 'span' },
    ]);
  });

  it('fills t after a degraded insert deletes it', () => {
    const buffer = {
      _mainThreadBuffer: {
        snapshots: [] as Array<{ t?: unknown }>,
      },
    };
    const insert = wrapObserveSnapshotInsert(function (this: {
      _mainThreadBuffer?: { snapshots?: Array<{ t?: unknown }> };
    }) {
      this._mainThreadBuffer?.snapshots?.push({});
    }, 'snapshots');

    insert.call(buffer, {});

    expect(buffer._mainThreadBuffer.snapshots).toEqual([{ t: [] }]);
  });

  it('does not log a trace step that ends after its snapshot is gone', () => {
    const endStep = jest.fn();
    const wrapped = wrapObserveTraceEnd(endStep);
    const registry = { traceSnapshots: new Map<string, unknown>() };

    wrapped.call(registry, 'trace-1', 'span', 'ImportService', 'enrich');

    expect(endStep).not.toHaveBeenCalled();

    registry.traceSnapshots.set('trace-1', {});
    wrapped.call(registry, 'trace-1', 'span', 'ImportService', 'enrich');
    expect(endStep).toHaveBeenCalledWith(
      'trace-1',
      'span',
      'ImportService',
      'enrich',
    );
  });
});
