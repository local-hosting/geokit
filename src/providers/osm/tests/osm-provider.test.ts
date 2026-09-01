import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OsmService,
  buildOverpassPlaceSearchQuery,
  normalizeOverpassElement,
  parseOsmTag,
} from '../src/osm-service';

describe('@geokit/osm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses OSM tags', () => {
    expect(parseOsmTag('shop=electronics')).toEqual({
      key: 'shop',
      value: 'electronics',
    });
    expect(parseOsmTag('invalid')).toBeNull();
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

});
