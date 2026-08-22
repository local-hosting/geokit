import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeospatialWorkerPool } from '../../../../src/utils/performance/worker-pool.js';

type WorkerHandler = {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((error: ErrorEvent) => void) | null;
  postMessage: (payload: unknown) => void;
  terminate: () => void;
};

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;
  terminated = false;

  constructor(_script: string) {
    MockWorker.instances.push(this);
  }

  postMessage(payload: { taskId: string; type: string; data: unknown }) {
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          taskId: payload.taskId,
          result: { ok: true, type: payload.type, data: payload.data },
        },
      } as MessageEvent);
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe('GeospatialWorkerPool', () => {
  afterEach(() => {
    MockWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it('executes queued tasks and resolves results', async () => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 });

    const pool = new GeospatialWorkerPool('worker.js', 1);
    const result = await pool.execute('polygonToH3', { polygon: {}, resolution: 7 });
    expect(result).toEqual({
      ok: true,
      type: 'polygonToH3',
      data: { polygon: {}, resolution: 7 },
    });
    pool.terminate();
    expect(MockWorker.instances[0]?.terminated).toBe(true);
  });

  it('rejects pending tasks when terminated', async () => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 });

    const pool = new GeospatialWorkerPool('worker.js', 1);
    const pending = pool.execute('clusterPoints', { points: [], options: { method: 'grid', threshold: 1 } });
    pool.terminate();
    await expect(pending).rejects.toThrow('Worker pool terminated');
  });

  it('rejects active tasks on worker error', async () => {
    class ErrorWorker implements WorkerHandler {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((error: ErrorEvent) => void) | null = null;
      postMessage() {
        queueMicrotask(() => {
          this.onerror?.({ message: 'boom' } as ErrorEvent);
        });
      }
      terminate() {}
    }

    vi.stubGlobal('Worker', ErrorWorker as unknown as typeof Worker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 });

    const pool = new GeospatialWorkerPool('worker.js', 1);
    await expect(pool.execute('intersectPolygons', { polygon1: {}, polygon2: {} })).rejects.toThrow(
      'Worker error: boom'
    );
    pool.terminate();
  });
});

import {
  clusterPointsAsync,
  getWorkerPool,
  intersectPolygonsAsync,
  polygonToH3Async,
} from '../../../../src/utils/performance/worker-pool.js';

describe('worker pool async helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates heavy operations to the shared worker pool', async () => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 });

    const pool = getWorkerPool();
    const executeSpy = vi.spyOn(pool, 'execute');

    await intersectPolygonsAsync({ type: 'Polygon' }, { type: 'Polygon' });
    await polygonToH3Async({ type: 'Polygon' }, 7);
    await clusterPointsAsync([{ location: [40.7, -74.0] }], { method: 'grid', threshold: 1000 });

    expect(executeSpy).toHaveBeenCalledWith('intersectPolygons', expect.any(Object));
    expect(executeSpy).toHaveBeenCalledWith('polygonToH3', expect.any(Object));
    expect(executeSpy).toHaveBeenCalledWith('clusterPoints', expect.any(Object));

    pool.terminate();
  });
});
