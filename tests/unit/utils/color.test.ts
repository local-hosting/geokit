import { describe, it, expect } from 'vitest';
import {
  createPaletteCycler,
  hexToHsl,
  hexToRgb,
  hslToHex,
} from '../../../src/utils/color';

describe('color utilities', () => {
  it('converts hsl to hex', () => {
    expect(hslToHex(0, 0, 46.7)).toBe('#777777');
  });

  it('converts hex to hsl', () => {
    const [h, s, l] = hexToHsl('#777777');
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeCloseTo(0, 0);
    expect(l).toBeCloseTo(46.7, 0);
  });

  it('parses hex to rgb', () => {
    expect(hexToRgb('#ff8040')).toEqual({ r: 255, g: 128, b: 64 });
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('cycles palette without repeats until exhausted', () => {
    const cycler = createPaletteCycler(['#111111', '#222222', '#333333']);
    const seen = new Set<string>();
    seen.add(cycler.next());
    seen.add(cycler.next());
    seen.add(cycler.next());
    expect(seen.size).toBe(3);
    cycler.reset();
    expect(cycler.next()).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
