import { describe, expect, it } from 'vitest';
import { addStateBoundaries } from '../../src/ui/utils/state-boundaries';
import { ADMIN_STATE_GEOJSON_SOURCE_OPTIONS } from '../../src/ui/utils/geojson-source-options';

describe('state-boundaries', () => {
  it('addStateBoundaries dedupes shared edges into line segments', () => {
    const states: GeoJSON.FeatureCollection = {
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
    const lines = addStateBoundaries(null, states, {
      sourceId: 's',
      lineLayerId: 's-line',
      lineColor: '#fff',
      lineWidth: 1,
    });
    expect(lines.features.length).toBe(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(5);
  });

  it('ADMIN_STATE_GEOJSON_SOURCE_OPTIONS simplifies state vt tiles', () => {
    expect(ADMIN_STATE_GEOJSON_SOURCE_OPTIONS).toEqual({ tolerance: 1, buffer: 256, maxzoom: 14 });
  });
});
