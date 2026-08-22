import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertResponseOk,
  fetchWithRetry,
  requireAPIKey,
  retryOn429,
} from '../src/providers/api-utils.js';

describe('api-utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requireAPIKey throws when key is missing', () => {
    expect(() => requireAPIKey('', 'Mapbox')).toThrow('Mapbox: No API key configured.');
    expect(() => requireAPIKey(undefined, 'Maptiler')).toThrow('Maptiler: No API key configured.');
    expect(() => requireAPIKey('token', 'Mapbox')).not.toThrow();
  });

  it('assertResponseOk passes for ok responses', async () => {
    await expect(assertResponseOk(new Response('ok', { status: 200 }), 'Test')).resolves.toBeUndefined();
  });

  it('assertResponseOk throws with parsed message for error responses', async () => {
    const response = new Response(JSON.stringify({ message: 'bad token' }), {
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(assertResponseOk(response, 'Mapbox')).rejects.toThrow(
      'Mapbox API error: 401 Unauthorized - bad token'
    );
  });

  it('retryOn429 retries then returns successful response', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const delaySpy = vi.spyOn(await import('geokit/utils/retry'), 'delay').mockResolvedValue();

    const response = await retryOn429(fn, { maxRetries: 2, baseDelayMs: 1, providerName: 'Test' });
    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(delaySpy).toHaveBeenCalled();
  });

  it('retryOn429 throws after max retries', async () => {
    const fn = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    vi.spyOn(await import('geokit/utils/retry'), 'delay').mockResolvedValue();
    await expect(retryOn429(fn, { maxRetries: 1, baseDelayMs: 1, providerName: 'Test' })).rejects.toThrow(
      'max retries exceeded'
    );
  });

  it('fetchWithRetry validates successful responses', async () => {
    const fn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const response = await fetchWithRetry(fn, 'Test');
    expect(response.ok).toBe(true);
  });
});
