import { describe, expect, it } from 'vitest';
import { generateGeodesicCirclePolygon } from '../../../src/ui/utils/geodesic-circle';
import {
  CachedPointFeatureBuilder,
  normalizePointCoordinates,
} from '../../../src/ui/utils/shared-point-features';
import {
  paintColorFromProperty,
  sharedPointRadiusByPropertyExpression,
} from '../../../src/ui/utils/shared-point-paint';

describe('geodesic circle', () => {
  it('generates a closed ring with steps + 1 coordinates', () => {
    const ring = generateGeodesicCirclePolygon(-85.7, 38.2, 1609.34 * 30, 64);
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

describe('normalizePointCoordinates', () => {
  it('returns null for invalid geometry', () => {
    expect(normalizePointCoordinates(null)).toBeNull();
    expect(normalizePointCoordinates({ geometry: { type: 'LineString' } })).toBeNull();
  });

  it('normalizes numeric lng/lat', () => {
    expect(
      normalizePointCoordinates({
        geometry: { type: 'Point', coordinates: ['-85.7', '38.2'] },
      })
    ).toEqual({ type: 'Point', coordinates: [-85.7, 38.2] });
  });
});

describe('shared point paint', () => {
  it('builds coalesce color expression', () => {
    expect(paintColorFromProperty('_color', '#ccc')).toEqual([
      'coalesce',
      ['get', '_color'],
      '#ccc',
    ]);
  });

  it('scales radius for non-primary brand values', () => {
    const expr = sharedPointRadiusByPropertyExpression('brand', 'acme');
    expect(expr[0]).toBe('*');
    expect(expr[2][0]).toBe('case');
  });
});

describe('CachedPointFeatureBuilder', () => {
  it('reuses cached features when validation passes', () => {
    const builder = new CachedPointFeatureBuilder({ maxCacheSize: 10 });
    type Item = { id: string; color: string; lng: number; lat: number };

    const first = builder.build<Item>({
      items: [{ id: 'a', color: 'red', lng: 1, lat: 2 }],
      getFeatureId: (item) => item.id,
      getGeometry: (item) => ({
        type: 'Point',
        coordinates: [item.lng, item.lat],
      }),
      getProperties: (item) => ({ _color: item.color }),
      isCacheValid: (cached, item) => cached.properties._color === item.color,
    });

    const second = builder.build<Item>({
      items: [{ id: 'a', color: 'red', lng: 1, lat: 2 }],
      getFeatureId: (item) => item.id,
      getGeometry: (item) => ({
        type: 'Point',
        coordinates: [item.lng, item.lat],
      }),
      getProperties: (item) => ({ _color: item.color }),
      isCacheValid: (cached, item) => cached.properties._color === item.color,
    });

    expect(first.features[0]).toBe(second.features[0]);
  });
});
