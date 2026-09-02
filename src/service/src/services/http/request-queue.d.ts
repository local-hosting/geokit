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
 * Concurrent request queue with configurable batch size and inter-batch delay.
 *
 * @example
 * ```typescript
 * const queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });
 *
 * const result = await queue.enqueue(() => fetch(url).then(r => r.json()));
 * ```
 */
export declare class RequestQueue {
    private queue;
    private isProcessing;
    private readonly maxConcurrent;
    private readonly batchDelayMs;
    constructor(options?: RequestQueueOptions);
    /**
     * Add a request to the queue and return a promise for its result.
     * Requests are processed in batches of `maxConcurrent`.
     */
    enqueue<T>(fn: () => Promise<T>): Promise<T>;
    /** Number of items waiting in the queue */
    get pending(): number;
    private processQueue;
}
//# sourceMappingURL=request-queue.d.ts.map