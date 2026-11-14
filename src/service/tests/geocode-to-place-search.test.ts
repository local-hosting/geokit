import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';

import { geocodeFeaturesToPlaceSearchResults } from '../src/geocode-to-place-search';

describe('geocodeFeaturesToPlaceSearchResults', () => {
  it('maps point features with properties.name to place rows', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'city:boston',
          geometry: { type: 'Point', coordinates: [-71.0589, 42.3601] },
          properties: {
            name: 'Boston',
            place_name: 'Boston, Massachusetts, United States',
          },
        },
      ],
    };

    expect(geocodeFeaturesToPlaceSearchResults(fc)).toEqual([
      {
        id: 'city:boston',
        name: 'Boston',
        address: 'Boston, Massachusetts, United States',
        location: [-71.0589, 42.3601],
      },
    ]);
  });

  it('skips non-point geometries', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [] },
          properties: { name: 'Nope' },
        },
      ],
    };
    expect(geocodeFeaturesToPlaceSearchResults(fc)).toEqual([]);
  });

  it('respects limit', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 2] },
          properties: { name: 'A' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [3, 4] },
          properties: { name: 'B' },
        },
      ],
    };
    expect(geocodeFeaturesToPlaceSearchResults(fc, 1)).toHaveLength(1);
  });
});
