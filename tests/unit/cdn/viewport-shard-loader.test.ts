import { describe, expect, it, vi } from 'vitest';
import {
  bindIncrementalViewportSync,
  loadFeatureCollectionShardsForH3Cells,
  normalizeLoadedCellId,
} from '../../../src/cdn/viewport-shard-loader';

describe('viewport-shard-loader', () => {
  it('normalizeLoadedCellId compacts trailing f padding', () => {
    expect(normalizeLoadedCellId('820c07fffffffff')).toBe('820c07');
  });

  it('merges incrementally without clearing existing features', async () => {
    const target = new Map<string, GeoJSON.Feature>([
      [
        'austin',
        {
          type: 'Feature',
          properties: { slug: 'austin' },
          geometry: null,
        },
      ],
    ]);
    const loadedCellIds = new Set<string>(['820c07']);
    const fetchShard = vi.fn(async (cellId: string) => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { slug: cellId === '822617' ? 'houston' : 'dallas' },
          geometry: null,
        },
      ],
    }));

    const result = await loadFeatureCollectionShardsForH3Cells({
      cellIds: ['820c07', '822617'],
      target,
      fetchShard,
      getFeatureId: (feature) =>
        String((feature.properties as { slug?: string }).slug ?? '').trim() || null,
      replace: false,
      loadedCellIds,
    });

    expect(fetchShard).toHaveBeenCalledTimes(1);
    expect(fetchShard).toHaveBeenCalledWith('822617');
    expect(result.features).toBe(2);
    expect(target.has('austin')).toBe(true);
    expect(target.has('houston')).toBe(true);
    expect(loadedCellIds.has('822617')).toBe(true);
  });

  it('bindIncrementalViewportSync wires move, moveend, and zoomend', async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, Set<() => void>>();
    const map = {
      on: (event: string, handler: () => void) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
      },
      off: (event: string, handler: () => void) => {
        handlers.get(event)?.delete(handler);
      },
    };
    const load = vi.fn(async () => {});
    const cleanup = bindIncrementalViewportSync({
      map,
      load,
      moveThrottleMs: 100,
      moveEndDebounceMs: 50,
    });

    expect(handlers.has('move')).toBe(true);
    expect(handlers.has('moveend')).toBe(true);
    expect(handlers.has('zoomend')).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);

    for (const handler of handlers.get('move') ?? []) handler();
    await vi.advanceTimersByTimeAsync(100);
    expect(load).toHaveBeenCalledTimes(2);

    for (const handler of handlers.get('moveend') ?? []) handler();
    await vi.advanceTimersByTimeAsync(50);
    expect(load).toHaveBeenCalledTimes(3);

    cleanup();
    vi.useRealTimers();
  });
});
