import { describe, expect, it } from 'vitest';

import {
  normalizeMaptilerGeocodeCollection,
  normalizeMaptilerGeocodeFeature,
  type MaptilerGeocodeFeature,
} from '../src/normalize-maptiler-geocode';

describe('normalizeMaptilerGeocodeFeature', () => {
  it('copies root text/place_name into properties', () => {
    const feature: MaptilerGeocodeFeature = {
      type: 'Feature',
      id: 'municipality.268346',
      geometry: {
        type: 'Point',
        coordinates: [-71.05783056467772, 42.358833784280414],
      },
      properties: { ref: 'osm:r2315704', country_code: 'us', kind: 'admin_area' },
      text: 'Boston',
      place_name: 'Boston, Massachusetts, United States',
    };

    expect(normalizeMaptilerGeocodeFeature(feature).properties).toMatchObject({
      ref: 'osm:r2315704',
      name: 'Boston',
      place_name: 'Boston, Massachusetts, United States',
    });
  });

  it('keeps existing properties.name', () => {
    const feature: MaptilerGeocodeFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
      properties: { name: 'Existing', place_name: 'Existing, NY' },
      text: 'Ignored',
      place_name: 'Ignored root',
    };

    expect(normalizeMaptilerGeocodeFeature(feature).properties).toMatchObject({
      name: 'Existing',
      place_name: 'Existing, NY',
    });
  });
});

describe('normalizeMaptilerGeocodeCollection', () => {
  it('maps every feature', () => {
    const result = normalizeMaptilerGeocodeCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-71.06, 42.36] },
          properties: {},
          text: 'Boston',
          place_name: 'Boston, Massachusetts, United States',
        } as MaptilerGeocodeFeature,
      ],
    });

    expect(result.features[0]?.properties).toMatchObject({
      name: 'Boston',
      place_name: 'Boston, Massachusetts, United States',
    });
  });
});
