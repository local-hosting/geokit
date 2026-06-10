import { describe, expect, it } from 'vitest';
import {
  capPolygonCollectionForMapLibre,
  MAPLIBRE_BOUNDARY_LINE_VERTEX_CHUNK,
  polygonsToBoundaryLines,
  ringToBoundaryLineChunks,
} from '../../src/utils/geojson/boundary-lines';

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

  it('preserves dense vertices for small rings', () => {
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

  it('caps uncapped state-sized rings before line emit', () => {
    const ring: GeoJSON.Position[] = [];
    for (let i = 0; i < 9000; i += 1) {
      ring.push([i * 0.0001, 0]);
    }

    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'big' },
          geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]!]] },
        },
      ],
    };

    const capped = capPolygonCollectionForMapLibre(collection);
    const outer = capped.features[0]!.geometry as GeoJSON.Polygon;
    expect(outer.coordinates[0]!.length).toBeLessThanOrEqual(900);

    const lines = polygonsToBoundaryLines(collection);
    expect(
      lines.features.every(
        (f) => f.geometry.coordinates.length <= MAPLIBRE_BOUNDARY_LINE_VERTEX_CHUNK
      )
    ).toBe(true);
  });

  it('splits rings above MapLibre line chunk size', () => {
    const ring: GeoJSON.Position[] = [];
    for (let i = 0; i < 5000; i += 1) {
      ring.push([i * 0.0001, 0]);
    }
    ring.push([0.5, 0.01], [0, 0.01], [0, 0]);

    const chunks = ringToBoundaryLineChunks(ring);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= MAPLIBRE_BOUNDARY_LINE_VERTEX_CHUNK)).toBe(true);
  });
});
