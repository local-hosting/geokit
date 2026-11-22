import { describe, expect, it, vi } from 'vitest';
import { mapHasLayer } from '../../../src/utils/map-surface/map-utils';

describe('mapHasLayer', () => {
  it('returns false when getLayer throws (style not attached)', () => {
    const map = {
      getLayer: vi.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'getOwnLayer')");
      }),
    };

    expect(mapHasLayer(map as never, 'demo-glow')).toBe(false);
  });

  it('returns true when getLayer finds the layer', () => {
    const map = {
      getLayer: vi.fn((id: string) => (id === 'demo-glow' ? {} : null)),
    };

    expect(mapHasLayer(map as never, 'demo-glow')).toBe(true);
    expect(mapHasLayer(map as never, 'missing')).toBe(false);
  });
});