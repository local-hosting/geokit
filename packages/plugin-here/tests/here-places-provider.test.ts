import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPlaceTaxonomyResolver } from '@geokit/api/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';
import {
  HerePlacesAPIProvider,
  buildHereDiscoverUrl,
  normalizeHereDiscoverItem,
} from '../src/here-places-provider.js';

describe('@geokit/plugin-here', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
  });

  it('builds discover url with geotype categories', () => {
    const url = buildHereDiscoverUrl(
      { ll: [-86.78, 36.16], radius: 1200, geotypes: ['RSE'], limit: 5 },
      'test-key',
      ['ELECTRONICS_STORE']
    );
    expect(url).toContain('discover.search.hereapi.com');
    expect(url).toContain('categories=ELECTRONICS_STORE');
    expect(url).toContain('in=circle%3A36.16%2C-86.78%3Br%3D1200');
    expect(url).toContain('limit=5');
  });

  it('normalizes discover items', () => {
    const result = normalizeHereDiscoverItem({
      id: 'here:poi:1',
      title: 'Tech World',
      position: { lat: 36.16, lng: -86.78 },
      address: { label: '123 Main St' },
      categories: [{ name: 'ELECTRONICS_STORE', primary: true }],
    });
    expect(result).toMatchObject({
      id: 'here:poi:1',
      name: 'Tech World',
      location: [-86.78, 36.16],
      categories: ['ELECTRONICS_STORE'],
    });
  });

  it('searches places with mocked HERE response', async () => {
    const provider = new HerePlacesAPIProvider();
    await provider.initialize({ apiKey: 'test-key' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          items: [
            {
              id: 'here:poi:99',
              title: 'Electronics Hub',
              position: { lat: 36.16, lng: -86.78 },
              categories: [{ name: 'ELECTRONICS_STORE', primary: true }],
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
  });
});
