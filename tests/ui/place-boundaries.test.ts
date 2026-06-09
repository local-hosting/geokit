import { describe, expect, it } from 'vitest';
import { ensurePlaceBoundaries } from '../../src/ui/utils/place-boundaries';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from '../../src/ui/utils/geojson-source-options';

describe('place-boundaries', () => {
  it('ensurePlaceBoundaries emits ring linestrings from city polygons', () => {
    const cities: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { slug: 'nashville' },
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
    const lines = ensurePlaceBoundaries(null, cities, {
      sourceId: 'city-src',
      lineLayerId: 'city-line',
      lineColor: '#93c5fd',
      lineWidth: 1,
    });
    expect(lines.features).toHaveLength(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(5);
  });

  it('BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS uses zero tolerance and tile buffer', () => {
    expect(BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS).toEqual({
      tolerance: 0,
      buffer: 256,
      maxzoom: 14,
    });
  });
});
