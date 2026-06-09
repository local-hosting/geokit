import { describe, expect, it } from 'vitest';
import { polygonsToBoundaryLines } from '../../src/utils/geojson/boundary-lines';

describe('polygonsToBoundaryLines', () => {
  it('emits one ring linestring per polygon', () => {
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
    expect(lines.features).toHaveLength(2);
    expect(lines.features.every((feature) => feature.geometry.coordinates.length === 5)).toBe(true);
  });

  it('preserves dense vertices for vt tile clipping at low zoom', () => {
    const ring: GeoJSON.Position[] = [];
    for (let i = 0; i <= 10; i += 1) {
      ring.push([i * 0.001, 0]);
    }
    ring.push([0.01, 0.01], [0, 0.01], [0, 0]);

    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      ],
    };

    const lines = polygonsToBoundaryLines(collection);
    expect(lines.features).toHaveLength(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(ring.length);
  });
});
