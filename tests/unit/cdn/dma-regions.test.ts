import { describe, expect, it } from 'vitest';
import {
  dmaCatalogEntriesFromRegionIndex,
  mergeDmaFeaturesBySlug,
  resolveRegionIdsForSlugs,
  resolveRegionIdsForViewport,
  resolveRegionIdsForViewportBounds,
} from '../../../src/cdn/dma-regions';
import type { DmaRegionClusterIndex } from '../../../src/types/dma';

describe('geokit/cdn dma-regions', () => {
  it('dedupes DMA features by slug when merging regional shards', () => {
    const target = new Map<string, GeoJSON.Feature>();
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'austin',
          properties: { slug: 'austin' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
        {
          type: 'Feature',
          id: 'austin',
          properties: { slug: 'austin' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
        {
          type: 'Feature',
          id: 'dallas',
          properties: { slug: 'dallas' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };

    expect(mergeDmaFeaturesBySlug(target, collection)).toBe(2);
    expect(target.size).toBe(2);
  });

  it('derives slug catalog from regional index entries', () => {
    const index: DmaRegionClusterIndex = {
      version: 1,
      regions: 'georef-us',
      resolution: 2,
      h3CellRegions: {},
      entries: [
        {
          regionId: 'texas-la',
          url: '/markets/dma/regions/texas-la.json',
          marketCount: 2,
          markets: ['austin', 'dallas'],
        },
      ],
    };

    expect(dmaCatalogEntriesFromRegionIndex(index)).toEqual([
      { slug: 'austin', region: 'texas-la' },
      { slug: 'dallas', region: 'texas-la' },
    ]);
  });

  it('resolves region ids for market slugs', () => {
    const index: DmaRegionClusterIndex = {
      version: 1,
      regions: 'georef-us',
      resolution: 2,
      h3CellRegions: {},
      entries: [
        {
          regionId: 'texas-la',
          url: '/markets/dma/regions/texas-la.json',
          marketCount: 2,
          markets: ['austin', 'dallas'],
        },
        {
          regionId: 'midwest',
          url: '/markets/dma/regions/midwest.json',
          marketCount: 1,
          markets: ['chicago'],
        },
      ],
    };

    expect(resolveRegionIdsForSlugs(index, ['dallas'])).toEqual(['texas-la']);
  });

  it('prefers H3 cell routing over bbox intersection', () => {
    const index: DmaRegionClusterIndex = {
      version: 1,
      regions: 'georef-us',
      resolution: 2,
      entries: [
        {
          regionId: 'great-lakes',
          url: '/markets/dma/regions/great-lakes.json',
          marketCount: 1,
          bbox: [-92, 36, -80, 44],
        },
        {
          regionId: 'west',
          url: '/markets/dma/regions/west.json',
          marketCount: 1,
          bbox: [-125, 32, -102, 49],
        },
      ],
      h3CellRegions: { '822a107': 'texas-la' },
    };

    expect(
      resolveRegionIdsForViewport(index, ['822a107fffffffff'], {
        bounds: { west: -88, south: 38, east: -84, north: 42 },
      })
    ).toEqual(['texas-la']);
  });

  it('returns regions whose shard bbox intersects the viewport', () => {
    const index: DmaRegionClusterIndex = {
      version: 1,
      regions: 'georef-us',
      resolution: 2,
      entries: [
        {
          regionId: 'texas-la',
          url: '/markets/dma/regions/texas-la.json',
          marketCount: 1,
          bbox: [-106, 25, -89, 37],
        },
      ],
      h3CellRegions: {},
    };

    expect(
      resolveRegionIdsForViewportBounds(index, {
        west: -98,
        south: 30,
        east: -90,
        north: 36,
      })
    ).toEqual(['texas-la']);
  });
});
