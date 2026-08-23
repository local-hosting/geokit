import { describe, expect, it } from 'vitest';
import { buildPlaceSearchCacheKey } from '../src/place-search-cache.js';

describe('buildPlaceSearchCacheKey', () => {
  it('builds a stable key from common placeSearch options', () => {
    const key = buildPlaceSearchCacheKey(
      {
        query: 'coffee',
        ll: [-86.781, 36.162],
        radius: 800,
        geotypes: ['RSE'],
        limit: 10,
      },
      'here'
    );

    expect(key.startsWith('here:')).toBe(true);
    expect(key).toContain('q:coffee');
    expect(key).toContain('gt:RSE');
    expect(key).toContain('r:800');
    expect(key).toContain('lim:10');
  });

  it('uses categories when geotypes are absent', () => {
    const key = buildPlaceSearchCacheKey(
      { categories: ['13065'], ll: [-86.78, 36.16] },
      'fsq'
    );
    expect(key).toContain('cat:13065');
  });

  it('appends provider-specific extra parts', () => {
    const key = buildPlaceSearchCacheKey({ query: 'pizza' }, 'fsq', ['sort:DISTANCE']);
    expect(key).toBe('fsq:q:pizza:sort:DISTANCE');
  });
});
