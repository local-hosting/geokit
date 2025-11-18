import { describe, it, expect } from 'vitest';
import {
  getCoordinates,
  createFeature,
  createFeatureCollection,
  extractGeometry,
} from '../src/geojson';
import type { Feature, Point } from '../src/types';

describe('geojson', () => {
  const pointGeometry: Point = {
    type: 'Point',
    coordinates: [-74.006, 40.7128],
  };

  const feature: Feature = {
    type: 'Feature',
    geometry: pointGeometry,
    properties: { name: 'New York' },
  };

  describe('getCoordinates', () => {
    it('should extract coordinates from Feature', () => {
      const coords = getCoordinates(feature);
      expect(coords).toEqual([-74.006, 40.7128]);
    });

    it('should extract coordinates from Geometry', () => {
      const coords = getCoordinates(pointGeometry);
      expect(coords).toEqual([-74.006, 40.7128]);
    });

    it('should return null for non-Point geometry', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-74, 40],
            [-73, 40],
            [-73, 41],
            [-74, 41],
            [-74, 40],
          ],
        ],
      };
      const coords = getCoordinates(polygon);
      expect(coords).toBe(null);
    });
  });

  describe('createFeature', () => {
    it('should create a Feature from geometry', () => {
      const newFeature = createFeature(pointGeometry);
      expect(newFeature).toEqual({
        type: 'Feature',
        geometry: pointGeometry,
        properties: {},
      });
    });

    it('should create a Feature with properties', () => {
      const newFeature = createFeature(pointGeometry, { name: 'Test' });
      expect(newFeature).toEqual({
        type: 'Feature',
        geometry: pointGeometry,
        properties: { name: 'Test' },
      });
    });
  });

  describe('createFeatureCollection', () => {
    it('should create a FeatureCollection from features', () => {
      const features = [
        createFeature(pointGeometry, { name: 'Location 1' }),
        createFeature(pointGeometry, { name: 'Location 2' }),
      ];
      const collection = createFeatureCollection(features);
      expect(collection).toEqual({
        type: 'FeatureCollection',
        features,
      });
    });
  });

  describe('extractGeometry', () => {
    it('should extract geometry from Feature', () => {
      const geometry = extractGeometry(feature);
      expect(geometry).toEqual(pointGeometry);
    });

    it('should return null for invalid input', () => {
      expect(extractGeometry(null as any)).toBe(null);
      expect(extractGeometry({} as any)).toBe(null);
    });
  });
});
