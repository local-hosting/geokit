import { describe, it, expect } from 'vitest';
import { interpolateAlongPath } from '../../../src/utils/interpolation/along-path';

describe('interpolateAlongPath', () => {
  const path: [number, number][] = [
    [40.7128, -74.006],
    [40.72, -74.0],
    [40.73, -73.99],
  ];

  it('returns start at fraction 0', () => {
    const point = interpolateAlongPath(0)(path);
    expect(point?.[0]).toBeCloseTo(40.7128, 4);
    expect(point?.[1]).toBeCloseTo(-74.006, 4);
  });

  it('returns end at fraction 1', () => {
    const point = interpolateAlongPath(1)(path);
    expect(point?.[0]).toBeCloseTo(40.73, 4);
    expect(point?.[1]).toBeCloseTo(-73.99, 4);
  });

  it('returns midpoint along path', () => {
    const point = interpolateAlongPath(0.5)(path);
    expect(point).not.toBeNull();
    expect(point![0]).toBeGreaterThan(40.7128);
    expect(point![0]).toBeLessThan(40.73);
  });

  it('accepts GeoJSON lon/lat coordinates', () => {
    const geoJsonPath: [number, number][] = [
      [-74.006, 40.7128],
      [-74.0, 40.72],
      [-73.99, 40.73],
    ];
    const point = interpolateAlongPath(1)(geoJsonPath);
    expect(point?.[0]).toBeCloseTo(40.73, 4);
    expect(point?.[1]).toBeCloseTo(-73.99, 4);
  });

  it('returns null for empty path', () => {
    expect(interpolateAlongPath(0.5)([])).toBeNull();
  });
});
