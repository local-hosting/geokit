import { describe, expect, it } from 'vitest';
import { bboxToPolygon, bboxToPolygonGeometry } from '../../../../src/utils/bounds/bbox-to-polygon.js';

const bounds: [number, number, number, number] = [-74.1, 40.6, -73.9, 40.8];

describe('bbox-to-polygon', () => {
  it('converts bounds to latlon ring by default', () => {
    const ring = bboxToPolygon(bounds);
    expect(ring[0]).toEqual([40.6, -74.1]);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });

  it('supports lonlat output format', () => {
    const ring = bboxToPolygon(bounds, 'lonlat');
    expect(ring[0]).toEqual([-74.1, 40.6]);
  });

  it('builds GeoJSON polygon geometry', () => {
    const geometry = bboxToPolygonGeometry(bounds);
    expect(geometry.type).toBe('Polygon');
    expect(geometry.coordinates[0][0]).toEqual([-74.1, 40.6]);
  });
});
