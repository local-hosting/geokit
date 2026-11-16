/**
 * Shared API Provider Utilities
 *
 * Common helpers extracted from the duplicated patterns across providers:
 * - API key / access token validation
 * - HTTP response error handling
 * - 429 rate-limit retry with exponential backoff
 */

import { delay } from '@doppler-group/geokit/core/utils/retry';

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------

/**
 * Validate that an API key or access token is present.
 * Throws immediately if missing — fail fast.
 *
 * @param key - The key/token value to check
 * @param providerName - Human-readable provider name for the error message
 */
export function requireAPIKey(
  key: string | null | undefined,
  providerName: string
): asserts key is string {
  if (!key) {
    throw new Error(`${providerName}: No API key configured.`);
  }
}

// ---------------------------------------------------------------------------
// HTTP response handling
// ---------------------------------------------------------------------------

/**
 * Check an HTTP response for errors and throw a descriptive error.
 * Tries to parse the response body as JSON for richer error messages.
 *
 * @param response - Fetch Response
 * @param providerName - Human-readable provider name for the error message
 * @throws If `response.ok` is false
 */
export async function assertResponseOk(response: Response, providerName: string): Promise<void> {
  if (response.ok) return;

  const body = await response.json().catch(() => ({}));
  const detail = (body as Record<string, unknown>).message
    ? ` - ${(body as Record<string, unknown>).message}`
    : '';

  throw new Error(`${providerName} API error: ${response.status} ${response.statusText}${detail}`);
}

// ---------------------------------------------------------------------------
// Rate-limit (429) retry helper
// ---------------------------------------------------------------------------

/**
 * Options for {@link retryOn429}
 */
export interface RateLimitRetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base retry delay in ms — doubled on each retry (default: 1000) */
  baseDelayMs?: number;
  /** Provider name for log messages */
  providerName?: string;
}

/**
 * Execute a fetch-like function that returns a `Response`.
 * If the response is 429, retry with exponential backoff.
 * For any other non-OK status the raw response is returned so the caller
 * can use {@link assertResponseOk} as usual.
 *
 * @param fn - Function that performs the HTTP request
 * @param options - Retry configuration
 * @returns The (non-429) Response
 */
export async function retryOn429(
  fn: () => Promise<Response>,
  options?: RateLimitRetryOptions
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 1000, providerName = 'API' } = options || {};

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fn();

    if (response.status !== 429) {
      return response;
    }

    // Last attempt — give up
    if (attempt === maxRetries) {
      throw new Error(`${providerName} API error: 429 - Too Many Requests (max retries exceeded)`);
    }

    const retryDelay = baseDelayMs * Math.pow(2, attempt);
    console.warn(
      `[gk-api] ${providerName} rate limited, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`
    );
    await delay(retryDelay);
  }

  // Unreachable, but satisfies TypeScript
  throw new Error(`${providerName} API error: 429 - Too Many Requests`);
}

// ---------------------------------------------------------------------------
// Convenience: fetch with 429 retry + assertResponseOk in one call
// ---------------------------------------------------------------------------

/**
 * Fetch with automatic 429 retry and response validation.
 * Combines {@link retryOn429} and {@link assertResponseOk}.
 *
 * @param fn - Function that performs the HTTP request
 * @param providerName - Provider name for error messages and logging
 * @param retryOptions - Optional retry configuration overrides
 * @returns The validated Response (guaranteed ok)
 */
export async function fetchWithRetry(
  fn: () => Promise<Response>,
  providerName: string,
  retryOptions?: Omit<RateLimitRetryOptions, 'providerName'>
): Promise<Response> {
  const response = await retryOn429(fn, { ...retryOptions, providerName });
  await assertResponseOk(response, providerName);
  return response;
}
