import { describe, expect, it } from 'vitest';
import { reachPolygon } from '../../../src/utils/logistics/reach-polygon';

describe('reachPolygon', () => {
  it('builds a radius buffer polygon', () => {
    const polygon = reachPolygon(34.05, -118.25, { kind: 'radius', miles: 10 });
    expect(polygon.type).toBe('Polygon');
    expect(polygon.coordinates[0]?.length).toBeGreaterThan(3);
  });

  it('builds a travel-time buffer polygon', () => {
    const polygon = reachPolygon(34.05, -118.25, {
      kind: 'travel',
      mode: 'driving',
      minutes: 30,
    });
    expect(polygon.type).toBe('Polygon');
  });
});
