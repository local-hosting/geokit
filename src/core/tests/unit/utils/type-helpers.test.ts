import { describe, expect, it } from 'vitest';
import { geo, createQuery, validateCoordinate } from '../../../src/utils/type-helpers';

const nyc: [number, number] = [40.7128, -74.006];
const nearby: [number, number] = [40.72, -74.0];
const far: [number, number] = [34.05, -118.24];

const squarePolygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-74.1, 40.6],
      [-73.9, 40.6],
      [-73.9, 40.8],
      [-74.1, 40.8],
      [-74.1, 40.6],
    ],
  ],
};

describe('type-helpers', () => {
  describe('geo', () => {
    it('calculates distance in multiple units', () => {
      const distance = geo(nyc).distanceTo(nearby);
      expect(distance.meters()).toBeGreaterThan(0);
      expect(distance.kilometers()).toBeGreaterThan(0);
      expect(distance.miles()).toBeGreaterThan(0);
    });

    it('accepts coordinate objects with lat/lon and latitude/longitude', () => {
      expect(geo({ lat: nyc[0], lon: nyc[1] }).distanceTo({ latitude: nearby[0], longitude: nearby[1] }).meters()).toBeGreaterThan(0);
      expect(geo({ coordinates: nyc }).distanceTo({ location: nearby }).meters()).toBeGreaterThan(0);
    });

    it('filters points within radius', () => {
      const within = geo(nyc).within(5000, [
        nearby,
        far,
        { coordinates: nearby },
      ]);
      expect(within.value().length).toBe(2);
    });

    it('checks polygon containment', () => {
      expect(geo(nyc).isInside(squarePolygon).value()).toBe(true);
      expect(geo(far).isInside(squarePolygon).value()).toBe(false);
    });

    it('throws for invalid coordinate input', () => {
      expect(() => geo({ invalid: true } as never).value()).toThrow('Invalid coordinate input');
    });
  });

  describe('validateCoordinate', () => {
    it('returns valid coordinate tuples unchanged', () => {
      expect(validateCoordinate(nyc)).toEqual(nyc);
    });
  });

  describe('createQuery', () => {
    it('filters, annotates distance, sorts, and limits results', () => {
      const items = [
        { id: 'near', coordinates: nearby },
        { id: 'far', coordinates: far },
        { id: 'invalid' },
      ];

      const result = createQuery()
        .withinDistance(nyc, 10_000_000)
        .addDistance(nyc)
        .sortByDistance()
        .limit(1)
        .execute(items);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('near');
      expect(result[0].distance).toBeGreaterThan(0);
    });

    it('filters by polygon containment', () => {
      const result = createQuery()
        .withinPolygon(squarePolygon)
        .execute([
          { id: 'inside', coordinates: nyc },
          { id: 'outside', coordinates: far },
        ]);
      expect(result.map((item) => item.id)).toEqual(['inside']);
    });
  });
});
