/**
 * Request queue — enqueue, batching, concurrency, batchDelayMs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestQueue } from '../../src/api/providers/request-queue';

describe('RequestQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should process a single request', async () => {
    const queue = new RequestQueue({ maxConcurrent: 2, batchDelayMs: 0 });
    const fn = vi.fn().mockResolvedValue(42);
    const p = queue.enqueue(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should respect maxConcurrent', async () => {
    const maxConcurrent = 2;
    const queue = new RequestQueue({ maxConcurrent, batchDelayMs: 0 });
    let inFlight = 0;
    let maxInFlight = 0;
    const fn = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return inFlight;
    });
    const p1 = queue.enqueue(fn);
    const p2 = queue.enqueue(fn);
    const p3 = queue.enqueue(fn);
    const p4 = queue.enqueue(fn);
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2, p3, p4]);
    expect(maxInFlight).toBeLessThanOrEqual(maxConcurrent);
  });

  it('should report pending count (items waiting, not yet processing)', async () => {
    const queue = new RequestQueue({ maxConcurrent: 1, batchDelayMs: 100 });
    const fn = vi.fn().mockImplementation(() => new Promise<void>(() => {}));
    queue.enqueue(fn);
    queue.enqueue(fn);
    queue.enqueue(fn);
    // One is taken into the batch when processQueue runs; remaining wait in queue
    expect(queue.pending).toBeGreaterThanOrEqual(2);
    expect(queue.pending).toBeLessThanOrEqual(3);
  });

  it('should process in FIFO order', async () => {
    const queue = new RequestQueue({ maxConcurrent: 1, batchDelayMs: 0 });
    const order: number[] = [];
    queue.enqueue(async () => {
      order.push(1);
      return 1;
    });
    queue.enqueue(async () => {
      order.push(2);
      return 2;
    });
    queue.enqueue(async () => {
      order.push(3);
      return 3;
    });
    await vi.runAllTimersAsync();
    expect(order).toEqual([1, 2, 3]);
  });

  it('should reject on thrown error', async () => {
    const queue = new RequestQueue({ maxConcurrent: 1, batchDelayMs: 0 });
    const err = new Error('fail');
    const p = queue.enqueue(async () => {
      throw err;
    });
    const rejection = expect(p).rejects.toThrow('fail');
    await vi.runAllTimersAsync();
    await rejection;
  });

  it('should use default options when not provided', async () => {
    const queue = new RequestQueue();
    expect(queue.pending).toBe(0);
    const fn = vi.fn().mockResolvedValue(1);
    const p = queue.enqueue(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe(1);
    expect(queue.pending).toBe(0);
  });
});
