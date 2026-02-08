/**
 * Retry Utility
 *
 * Generic retry logic with exponential backoff for async operations.
 * Framework-agnostic — usable in any JS/TS project.
 */

/**
 * Configuration for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Whether to log retry attempts to console (default: true) */
  logRetries?: boolean;
  /** Prefix for log messages (default: '[Retry]') */
  logPrefix?: string;
  /** Predicate — return false to stop retrying for a given error */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Execute an async function with retry logic and exponential backoff.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const data = await withRetry(() => fetch(url).then(r => r.json()), {
 *   maxRetries: 3,
 *   baseDelayMs: 1000,
 *   logPrefix: '[API]',
 * });
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    logRetries = true,
    logPrefix = '[Retry]',
    shouldRetry: shouldRetryFn,
  } = options || {};

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Exponential backoff on retries (skip delay on first attempt)
      if (attempt > 0) {
        const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
        await delay(backoffMs);
      }

      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // Allow caller to bail out of retries for certain errors
      if (shouldRetryFn && !shouldRetryFn(lastError)) {
        break;
      }

      if (attempt < maxRetries && logRetries) {
        console.warn(`${logPrefix} Attempt ${attempt + 1} failed, retrying...`, e);
      }
    }
  }

  if (logRetries) {
    console.error(`${logPrefix} Failed after ${maxRetries + 1} attempts:`, lastError);
  }

  throw lastError || new Error('Retry exhausted');
}

/**
 * Promise-based delay utility
 *
 * @param ms - Milliseconds to wait
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
