import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCountyFips } from '../../src/cdn/county';
import { resolvePlaceOrBoroughBounds } from '../../src/cdn/resolve-shape';

const BROOKLYN_FEATURE: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Kings County' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-74.05, 40.55],
        [-73.85, 40.55],
        [-73.85, 40.75],
        [-74.05, 40.75],
        [-74.05, 40.55],
      ],
    ],
  },
};

describe('geokit/cdn', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes county FIPS', () => {
    expect(normalizeCountyFips('36047')).toBe('36047');
    expect(normalizeCountyFips('6047')).toBe('06047');
  });

  it('resolves Brooklyn via borough county alias', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/us/county/36047')) {
        return new Response(JSON.stringify(BROOKLYN_FEATURE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const bounds = await resolvePlaceOrBoroughBounds('ny', 'brooklyn', {
      baseUrl: 'https://cdn.test',
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.length).toBe(4);
    const [minLon, minLat, maxLon, maxLat] = bounds!;
    expect(minLon).toBeLessThanOrEqual(-73.95);
    expect(maxLon).toBeGreaterThanOrEqual(-73.85);
    expect(minLat).toBeLessThanOrEqual(40.55);
    expect(maxLat).toBeGreaterThanOrEqual(40.75);
    expect(fetchMock).toHaveBeenCalled();
  });
});
