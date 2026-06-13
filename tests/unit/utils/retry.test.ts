/**
 * Retry utility — withRetry, delay, exponential backoff, shouldRetry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, delay } from '../../../src/utils/retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('delay', () => {
    it('should resolve after ms', async () => {
      const p = delay(100);
      vi.advanceTimersByTime(100);
      await expect(p).resolves.toBeUndefined();
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const p = withRetry(fn, { maxRetries: 2, baseDelayMs: 100, logRetries: false });
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(43);
      const p = withRetry(fn, { maxRetries: 2, baseDelayMs: 10, logRetries: false });
      await vi.runAllTimersAsync();
      const result = await p;
      expect(result).toBe(43);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      const err = new Error('always fail');
      const fn = vi.fn().mockRejectedValue(err);
      const p = withRetry(fn, { maxRetries: 2, baseDelayMs: 10, logRetries: false });
      const rejection = expect(p).rejects.toThrow('always fail');
      await vi.runAllTimersAsync();
      await rejection;
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff between retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const p = withRetry(fn, { maxRetries: 2, baseDelayMs: 100, logRetries: false });
      const rejection = expect(p).rejects.toThrow('fail');
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);
      await rejection;
    });

    it('should respect shouldRetry returning false', async () => {
      const err = new Error('no retry');
      const fn = vi.fn().mockRejectedValue(err);
      const p = withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        logRetries: false,
        shouldRetry: (e) => e.message !== 'no retry',
      });
      const rejection = expect(p).rejects.toThrow('no retry');
      await vi.runAllTimersAsync();
      await rejection;
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect shouldRetry returning true and retry', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('retry')).mockResolvedValueOnce(1);
      const p = withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        logRetries: false,
        shouldRetry: () => true,
      });
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBe(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use default options', async () => {
      const fn = vi.fn().mockResolvedValue(0);
      const p = withRetry(fn);
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
