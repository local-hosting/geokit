import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPlaceTaxonomyResolver } from '@geokit/service/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';
import {
  EsriPlacesService,
  buildEsriNearPointUrl,
  normalizeEsriPlace,
} from '../src/esri-places-provider.js';

describe('@geokit/esri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
  });

  it('builds near-point url with geotype category ids', () => {
    const url = buildEsriNearPointUrl(
      { ll: [-86.78, 36.16], radius: 1200, geotypes: ['RSE'], limit: 5 },
      ['4bf58dd8d48988d122951735']
    );
    expect(url).toContain('places/near-point');
    expect(url).toContain('categoryIds=4bf58dd8d48988d122951735');
    expect(url).toContain('x=-86.78');
    expect(url).toContain('y=36.16');
    expect(url).toContain('radius=1200');
    expect(url).toContain('pageSize=5');
  });

  it('normalizes esri place items', () => {
    const result = normalizeEsriPlace({
      placeId: 'esri:place:1',
      name: 'Tech World',
      location: { x: -86.78, y: 36.16 },
      categories: [{ categoryId: '4bf58dd8d48988d122951735', label: 'Electronics Store' }],
      distance: 90,
    });
    expect(result).toMatchObject({
      id: 'esri:place:1',
      name: 'Tech World',
      location: [-86.78, 36.16],
      categories: ['4bf58dd8d48988d122951735'],
      distance: 90,
    });
  });

  it('searches places with mocked Esri response', async () => {
    const provider = new EsriPlacesService();
    await provider.initialize({ apiKey: 'test-key' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          results: [
            {
              placeId: 'esri:place:99',
              name: 'Electronics Hub',
              location: { x: -86.78, y: 36.16 },
              categories: [
                { categoryId: '4bf58dd8d48988d122951735', label: 'Electronics Store' },
              ],
            },
          ],
        })
      )
    );

    const results = await provider.placeSearch({
      ll: [-86.78, 36.16],
      geotypes: ['RSE'],
      radius: 800,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.geotype).toBe('electronics_store');
    expect(results[0]?.geotypeAcronym).toBe('RSE');

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = new URL(String(fetchCall?.[0]));
    expect(url.searchParams.get('categoryIds')).toBe('4bf58dd8d48988d122951735');
    expect(fetchCall?.[1]?.headers?.Authorization).toBe('Bearer test-key');
  });
});
