import { describe, expect, it } from 'vitest';
import { GeoCache, ProviderCache, coordinateCacheKey, roundForCacheKey } from '../../../src/utils/cache.js';

describe('GeoCache', () => {
  it('stores, retrieves, and tracks hit/miss stats', () => {
    const cache = new GeoCache<string>({ name: 'test', maxEntries: 2, ttlMs: 1000 });
    expect(cache.get('missing')).toBeUndefined();
    cache.set('a', 'alpha');
    expect(cache.get('a')).toBe('alpha');
    expect(cache.has('a')).toBe(true);

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
    expect(stats.hitRate).toBe('50.0%');
  });

  it('deletes entries and clears stats', () => {
    const cache = new GeoCache<number>();
    cache.set('n', 42);
    expect(cache.delete('n')).toBe(true);
    cache.set('x', 1);
    cache.clear();
    expect(cache.getStats().size).toBe(0);
    expect(cache.getStats().hits).toBe(0);
  });
});

describe('cache key helpers', () => {
  it('rounds values for stable cache keys', () => {
    expect(roundForCacheKey(40.71284, 4)).toBe('40.7128');
  });

  it('builds coordinate cache keys with optional extras', () => {
    expect(coordinateCacheKey(40.71284, -74.00601)).toBe('40.7128,-74.0060');
    expect(coordinateCacheKey(40.7, -74.0, ['zoom', 12])).toBe('40.7000,-74.0000:zoom:12');
  });

  it('exposes cache metadata and deprecated alias', () => {
    const cache = new GeoCache({ name: 'provider-cache' });
    cache.set('k', 1);
    expect(cache.size).toBe(1);
    expect(cache.getName()).toBe('provider-cache');
    expect(cache.getStats().hitRate).toBe('0%');
    const alias = new ProviderCache<string>();
    alias.set('a', 'b');
    expect(alias.get('a')).toBe('b');
  });
});
