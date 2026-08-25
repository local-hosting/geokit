/**
 * Rate-Limited Request Queue
 *
 * Generic concurrent request queue with batching and inter-batch delay.
 * Extracted from the identical implementations in every API provider.
 */

/**
 * Configuration for the request queue
 */
export interface RequestQueueOptions {
  /** Maximum number of concurrent requests per batch (default: 6) */
  maxConcurrent?: number;
  /** Delay in ms between batches to avoid overwhelming the API (default: 50) */
  batchDelayMs?: number;
}

/**
 * Internal queue item — stores the work function and its promise handlers
 */
interface QueueItem {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  fn: () => Promise<unknown>;
}

/**
 * Concurrent request queue with configurable batch size and inter-batch delay.
 *
 * @example
 * ```typescript
 * const queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });
 *
 * const result = await queue.enqueue(() => fetch(url).then(r => r.json()));
 * ```
 */
export class RequestQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private readonly maxConcurrent: number;
  private readonly batchDelayMs: number;

  constructor(options?: RequestQueueOptions) {
    this.maxConcurrent = options?.maxConcurrent ?? 6;
    this.batchDelayMs = options?.batchDelayMs ?? 50;
  }

  /**
   * Add a request to the queue and return a promise for its result.
   * Requests are processed in batches of `maxConcurrent`.
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        resolve: resolve as (value: unknown) => void,
        reject,
        fn,
      });
      this.processQueue();
    });
  }

  /** Number of items waiting in the queue */
  get pending(): number {
    return this.queue.length;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const batch: QueueItem[] = [];
      while (batch.length < this.maxConcurrent && this.queue.length > 0) {
        const item = this.queue.shift();
        if (item) batch.push(item);
      }

      await Promise.all(
        batch.map(async (item) => {
          try {
            const result = await item.fn();
            item.resolve(result);
          } catch (error) {
            item.reject(error instanceof Error ? error : new Error(String(error)));
          }
        })
      );

      if (this.queue.length > 0) {
        await new Promise((r) => setTimeout(r, this.batchDelayMs));
      }
    }

    this.isProcessing = false;
  }
}
