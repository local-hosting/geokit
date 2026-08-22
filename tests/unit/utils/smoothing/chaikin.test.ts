import { describe, expect, it } from 'vitest';
import {
  smoothFeatureCollection,
  smoothGeometry,
  smoothLine,
  smoothMultiPolygon,
  smoothPolygon,
  smoothRing,
} from '../../../../src/utils/smoothing/chaikin';

const squareRing: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

const zigzagLine: [number, number][] = [
  [0, 0],
  [1, 0.5],
  [2, 0],
];

describe('chaikin smoothing', () => {
  describe('smoothRing', () => {
    it('returns short rings unchanged', () => {
      const short: [number, number][] = [
        [0, 0],
        [1, 0],
        [0, 0],
      ];
      expect(smoothRing(2)(short)).toEqual(short);
    });

    it('increases point count for closed rings', () => {
      const smoothed = smoothRing(1)(squareRing);
      expect(smoothed.length).toBeGreaterThan(squareRing.length);
      expect(smoothed[0]).toEqual(smoothed[smoothed.length - 1]);
    });

    it('handles corrupted object-with-numeric-keys input', () => {
      const corrupted = { 0: [0, 0], 1: [1, 0], 2: [1, 1], 3: [0, 1], 4: [0, 0] } as unknown as [
        number,
        number,
      ][];
      const smoothed = smoothRing(1)(corrupted);
      expect(smoothed.length).toBeGreaterThan(5);
    });
  });

  describe('smoothLine', () => {
    it('returns short lines unchanged', () => {
      const short: [number, number][] = [
        [0, 0],
        [1, 1],
      ];
      expect(smoothLine(2)(short)).toEqual(short);
    });

    it('adds interpolated points while preserving endpoints', () => {
      const smoothed = smoothLine(1)(zigzagLine);
      expect(smoothed.length).toBeGreaterThan(zigzagLine.length);
      expect(smoothed[0]).toEqual(zigzagLine[0]);
      expect(smoothed[smoothed.length - 1]).toEqual(zigzagLine[zigzagLine.length - 1]);
    });
  });

  describe('smoothPolygon', () => {
    it('smooths polygon coordinates', () => {
      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [squareRing],
      };
      const smoothed = smoothPolygon(1)(polygon);
      expect(smoothed.type).toBe('Polygon');
      expect(smoothed.coordinates[0].length).toBeGreaterThan(squareRing.length);
    });
  });

  describe('smoothMultiPolygon', () => {
    it('smooths each polygon ring', () => {
      const multi: GeoJSON.MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [[squareRing]],
      };
      const smoothed = smoothMultiPolygon(1)(multi);
      expect(smoothed.coordinates[0][0].length).toBeGreaterThan(squareRing.length);
    });
  });

  describe('smoothGeometry', () => {
    it('smooths supported geometry types and passes through points', () => {
      const line: GeoJSON.LineString = { type: 'LineString', coordinates: zigzagLine };
      const smoothedLine = smoothGeometry(1)(line);
      expect(smoothedLine.type).toBe('LineString');
      expect((smoothedLine as GeoJSON.LineString).coordinates.length).toBeGreaterThan(
        zigzagLine.length
      );

      const point: GeoJSON.Point = { type: 'Point', coordinates: [0, 0] };
      expect(smoothGeometry(1)(point)).toEqual(point);
    });
  });

  describe('smoothFeatureCollection', () => {
    it('smooths feature geometries in a collection', () => {
      const fc: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: zigzagLine },
          },
        ],
      };
      const smoothed = smoothFeatureCollection(1)(fc);
      const geometry = smoothed.features[0].geometry as GeoJSON.LineString;
      expect(geometry.coordinates.length).toBeGreaterThan(zigzagLine.length);
    });
  });
});
