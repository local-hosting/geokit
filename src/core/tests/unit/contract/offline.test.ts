import { describe, expect, it } from 'vitest';
import {
  MapOfflineDefaults,
  resolveOfflineCoverage,
  validateOfflinePrefetchRequest,
  enumerateOfflineTileCoordinates,
  estimateOfflineTileCount,
} from '../../../src/contract/offline';

describe('contract/offline', () => {
  it('clamps web prefetch zoom to budget', () => {
    const normalized = validateOfflinePrefetchRequest(
      {
        mapId: 'card-1',
        bounds: { south: 40.7, west: -74.1, north: 40.8, east: -73.9 },
        zoomRange: { minZoom: 10, maxZoom: 20 },
      },
      'web'
    );
    expect(normalized.zoomRange.maxZoom).toBe(
      MapOfflineDefaults.webStorageBudget.maxPrefetchZoom
    );
  });

  it('recommends snapshot when coverage is sparse', () => {
    const coverage = resolveOfflineCoverage(10, 100, 'snapshotFallback');
    expect(coverage.recommendsSnapshotFallback).toBe(true);
    expect(coverage.recommendsLiveMap).toBe(false);
  });

  it('rejects oversized prefetch on web', () => {
    expect(() =>
      validateOfflinePrefetchRequest(
        {
          mapId: 'card-1',
          bounds: { south: 40.7, west: -74.1, north: 40.8, east: -73.9 },
          zoomRange: { minZoom: 10, maxZoom: 12 },
          budget: {
            maxBytes: 100_000_000,
            maxPrefetchZoom: 15,
            maxTileCount: 1,
          },
        },
        'web'
      )
    ).toThrow(/estimated/);
  });

  it('enumerate matches tile count estimate', () => {
    const bounds = { south: 40.7, west: -74.1, north: 40.8, east: -73.9 };
    const zoomRange = { minZoom: 10, maxZoom: 11 };
    expect(enumerateOfflineTileCoordinates(bounds, zoomRange).length).toBe(
      estimateOfflineTileCount(bounds, zoomRange)
    );
  });
});
