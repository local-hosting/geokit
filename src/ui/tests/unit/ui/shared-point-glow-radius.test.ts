import { describe, it, expect } from 'vitest';
import {
  expandInterpolateCaseMultiply,
  sharedPointGlowRadiusFromPointExpression,
} from '../../../src/utils/shared-point-paint';

describe('sharedPointGlowRadiusFromPointExpression', () => {
  it('expands brand-scaled point radius for MapTiler-safe glow', () => {
    const pointRadius = [
      '*',
      ['interpolate', ['exponential', 1.5], ['zoom'], 0, 2.8, 10, 2.6],
      ['case', ['==', ['get', 'brand'], ['literal', 'primary']], 1, 0.9],
    ] as unknown[];

    const glow = sharedPointGlowRadiusFromPointExpression(pointRadius, 2.5);
    expect(glow[0]).toBe('case');
    expect(glow[2][0]).toBe('interpolate');
    expect(glow[2][4]).toBe(7);
    expect(glow[3][0]).toBe('interpolate');
    expect(glow[3][4]).toBeCloseTo(6.3, 5);
  });
});

describe('expandInterpolateCaseMultiply', () => {
  it('returns multiply expression when input is not case', () => {
    const interpolate = ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 4] as unknown[];
    const result = expandInterpolateCaseMultiply(interpolate, ['literal', 1], 2);
    expect(result[0]).toBe('*');
  });
});
