import { describe, expect, it } from 'vitest';

import {
  ROUNDED_RECT_SDF_INSET_RATIO,
  roundedRectSdfRaster,
  roundedRectShadowRaster,
} from '../../../src/utils/paint/rounded-rect-raster';

const SIZE = 128;
const MID = SIZE / 2;
const EDGE = Math.round(SIZE * ROUNDED_RECT_SDF_INSET_RATIO);
const HALF = MID - EDGE;

function alphaAt(data: Uint8ClampedArray, x: number, y: number): number {
  return data[(y * SIZE + x) * 4 + 3];
}

describe('roundedRectSdfRaster', () => {
  it('encodes a distance gradient (MapLibre SDF edge at ~0.75) instead of a hard mask', () => {
    const data = roundedRectSdfRaster(SIZE);
    expect(alphaAt(data, MID, MID)).toBe(255);
    expect(alphaAt(data, EDGE, MID)).toBeGreaterThan(170);
    expect(alphaAt(data, EDGE, MID)).toBeLessThan(215);
    expect(alphaAt(data, Math.round(EDGE / 2), MID)).toBeGreaterThan(40);
    expect(alphaAt(data, Math.round(EDGE / 2), MID)).toBeLessThan(170);
    expect(alphaAt(data, 0, 0)).toBe(0);
  });
});

describe('roundedRectShadowRaster', () => {
  it('fades like circle-blur: solid inside (1 - blur) of the half-width, clear at the badge edge', () => {
    const blur = 0.5;
    const data = roundedRectShadowRaster(SIZE, blur);
    expect(data[(MID * SIZE + MID) * 4]).toBe(0);
    expect(alphaAt(data, MID, MID)).toBe(255);
    expect(alphaAt(data, EDGE + Math.ceil(HALF * blur) + 1, MID)).toBe(255);
    expect(alphaAt(data, EDGE, MID)).toBeLessThanOrEqual(12);
    const midFade = alphaAt(data, EDGE + Math.round((HALF * blur) / 2), MID);
    expect(midFade).toBeGreaterThan(90);
    expect(midFade).toBeLessThan(170);
    expect(alphaAt(data, 0, 0)).toBe(0);
  });
});
