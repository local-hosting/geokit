import { describe, expect, it } from 'vitest';
import { addCountyBoundaries } from '../../src/ui/utils/county-boundaries';
import { ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS } from '../../src/ui/utils/geojson-source-options';

describe('county-boundaries', () => {
  it('addCountyBoundaries dedupes shared edges into line segments', () => {
    const counties: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const lines = addCountyBoundaries(null, counties, {
      sourceId: 'c',
      lineLayerId: 'c-line',
      lineColor: '#fff',
      lineWidth: 1,
    });
    expect(lines.features.length).toBe(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(5);
  });

  it('ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS simplifies county vt tiles', () => {
    expect(ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS).toEqual({ tolerance: 2, buffer: 256, maxzoom: 14 });
  });
});
