import { describe, expect, it } from 'vitest';
import { FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS } from '../../../src/utils/paint/choropleth-fill-paint';
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

  it('enables antialias for flat choropleth maps regardless of pitch or terrain', () => {
    expect(
      fillAntialiasForMap(
        { getPitch: () => 0, getTerrain: () => null },
        FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS
      )
    ).toBe(true);
    expect(
      fillAntialiasForMap(
        { getPitch: () => 22, getTerrain: () => null },
        FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS
      )
    ).toBe(true);
    expect(
      fillAntialiasForMap(
        { getPitch: () => 0, getTerrain: () => ({ source: 'dem' }) },
        FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS
      )
    ).toBe(true);
  });
});
