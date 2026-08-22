import { describe, expect, it } from 'vitest';
import * as turf from '../../../../src/utils/turf/index.js';

describe('turf barrel exports', () => {
  it('re-exports core measurement utilities', () => {
    expect(typeof turf.getBounds).toBe('function');
    expect(typeof turf.pointInPolygon).toBe('function');
    expect(typeof turf.polygonArea).toBe('function');
    expect(typeof turf.bboxToPolygon).toBe('function');
  });

  it('re-exported functions remain callable', () => {
    const nyc: [number, number] = [40.7128, -74.006];
    const la: [number, number] = [34.0522, -118.2437];
    const bounds = turf.getBounds([nyc, la]);
    expect(bounds).not.toBeNull();
    expect(bounds![2]).toBeGreaterThan(bounds![0]);
    expect(bounds![3]).toBeGreaterThan(bounds![1]);
    expect(turf.polygonArea({
      type: 'Polygon',
      coordinates: [
        [
          [-74.1, 40.6],
          [-73.9, 40.6],
          [-73.9, 40.8],
          [-74.1, 40.8],
          [-74.1, 40.6],
        ],
      ],
    })).toBeGreaterThan(0);
  });
});
