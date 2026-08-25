import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPlaceTaxonomyResolver } from '@geokit/service/place-taxonomy';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';
import {
  OsmService,
  buildOverpassPlaceSearchQuery,
  normalizeOverpassElement,
  parseOsmTag,
} from '../src/osm-provider.js';

describe('@geokit/osm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
  });

  it('parses OSM tags', () => {
    expect(parseOsmTag('shop=electronics')).toEqual({
      key: 'shop',
      value: 'electronics',
    });
    expect(parseOsmTag('invalid')).toBeNull();
  });

  it('builds an Overpass query from geotypes', () => {
    const query = buildOverpassPlaceSearchQuery(
      { ll: [-86.78, 36.16], radius: 500, limit: 5, geotypes: ['RSE'] },
      ['shop=electronics']
    );
    expect(query).toContain('around:500,36.16,-86.78');
    expect(query).toContain('["shop"="electronics"]');
    expect(query).toContain('out center 5');
  });

  it('normalizes Overpass elements', () => {
    const result = normalizeOverpassElement({
      type: 'node',
      id: 42,
      lat: 36.16,
      lon: -86.78,
      tags: { name: 'Tech Shop', shop: 'electronics' },
    });
    expect(result).toEqual({
      id: 'osm:node/42',
      name: 'Tech Shop',
      location: [-86.78, 36.16],
      categories: ['shop=electronics'],
      address: undefined,
      raw: expect.any(Object),
    });
  });

  it('searches places with mocked Overpass response', async () => {
    const provider = new OsmService();
    await provider.initialize({});

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          elements: [
            {
              type: 'node',
              id: 99,
              lat: 36.16,
              lon: -86.78,
              tags: { name: 'Electronics Hub', shop: 'electronics' },
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
