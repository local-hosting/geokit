import { describe, expect, it, beforeEach } from 'vitest';
import { loadUsCrosswalkSync, resetCrosswalkForTest } from '../src/load/load';
import {
  clearCountyBoundaries,
  convert,
  ensureUsCrosswalkLoaded,
  GKPoint,
  registerCountyBoundaries,
  setCountyBoundaryLoader,
} from '../src/index.ts';
import { GeoKind } from '@geokit/core';

function countyAround(
  lat: number,
  lon: number,
  dmaSlug: string,
  fips = '00000'
): GeoJSON.FeatureCollection {
  const d = 0.25;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { fips, dmaSlug },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [lon - d, lat - d],
              [lon + d, lat - d],
              [lon + d, lat + d],
              [lon - d, lat + d],
              [lon - d, lat - d],
            ],
          ],
        },
      },
    ],
  };
}

describe('point → DMA', () => {
  beforeEach(() => {
    resetCrosswalkForTest();
    clearCountyBoundaries();
    loadUsCrosswalkSync();
  });

  it('convert resolves DMA from county boundary containment', () => {
    const lat = 27.606887772143068;
    const lon = -99.47433471679688;
    registerCountyBoundaries(countyAround(lat, lon, 'laredo', '48479'));
    const dma = convert(GKPoint(lat, lon), GeoKind.DMA);
    expect(dma?.slug).toBe('laredo');
    expect(dma?.region).toBeTruthy();
  });

  it('returns undefined when county boundaries are not registered', () => {
    expect(convert(GKPoint(39.7684, -86.1581), GeoKind.DMA)).toBeUndefined();
  });

  it('ensureUsCrosswalkLoaded registers boundaries from loader', async () => {
    const lat = 39.7684;
    const lon = -86.1581;
    setCountyBoundaryLoader(async () => countyAround(lat, lon, 'indianapolis', '18097'));
    await ensureUsCrosswalkLoaded();
    const dma = convert(GKPoint(lat, lon), GeoKind.DMA);
    expect(dma?.slug).toBe('indianapolis');
  });
});
