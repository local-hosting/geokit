import { describe, expect, it } from 'vitest';
import { getFeatureId } from '../../../../src/utils/geojson/get-feature-id';

describe('getFeatureId', () => {
  it('returns id from common property names', () => {
    const feature = {
      type: 'Feature' as const,
      properties: { id: 123, slug: 'ignored' },
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    };
    expect(getFeatureId(feature)).toBe('123');
  });

  it('falls back to slug when id is missing', () => {
    const feature = {
      type: 'Feature' as const,
      properties: { slug: 'location-1' },
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    };
    expect(getFeatureId(feature)).toBe('location-1');
  });

  it('supports custom id property order', () => {
    const feature = {
      type: 'Feature' as const,
      properties: { id: 'a', customId: 'b' },
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    };
    expect(getFeatureId(feature, ['customId', 'id'])).toBe('b');
  });

  it('returns null when properties are missing or empty', () => {
    expect(
      getFeatureId({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] },
      })
    ).toBeNull();
    expect(
      getFeatureId({
        type: 'Feature',
        properties: null as unknown as Record<string, unknown>,
        geometry: { type: 'Point', coordinates: [0, 0] },
      })
    ).toBeNull();
  });
});
