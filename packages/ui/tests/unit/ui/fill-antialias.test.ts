import { describe, expect, it } from 'vitest';
import { fillAntialiasForMap } from '../../../src/utils/fill-antialias';

describe('fillAntialiasForMap', () => {
  it('prefers antialiased fills in flat-map mode', () => {
    expect(fillAntialiasForMap(null, { preferAntialiasedWhenFlat: true })).toBe(true);
  });

  it('uses pitch and terrain when not flat-map mode', () => {
    expect(fillAntialiasForMap({ getPitch: () => 0, getTerrain: () => null })).toBe(false);
    expect(fillAntialiasForMap({ getPitch: () => 2, getTerrain: () => null })).toBe(true);
    expect(fillAntialiasForMap({ getPitch: () => 0, getTerrain: () => ({}) })).toBe(true);
  });
});
