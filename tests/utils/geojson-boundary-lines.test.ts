import { describe, expect, it } from 'vitest';
import { polygonsToBoundaryLines } from '../../src/utils/geojson/boundary-lines';

describe('polygonsToBoundaryLines', () => {
  it('dedupes a shared edge between adjacent polygons', () => {
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'a' },
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
        {
          type: 'Feature',
          properties: { id: 'b' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 0],
                [2, 0],
                [2, 1],
                [1, 1],
                [1, 0],
              ],
            ],
          },
        },
      ],
    };

    const lines = polygonsToBoundaryLines(collection);
    expect(lines.features).toHaveLength(7);
  });
});
