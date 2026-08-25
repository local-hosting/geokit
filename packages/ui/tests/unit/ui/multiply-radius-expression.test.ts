import { describe, it, expect } from 'vitest';
import { multiplyRadiusExpression } from '../../../src/utils/layer-styles.js';

describe('multiplyRadiusExpression', () => {
  it('scales interpolate expressions by multiplying stops', () => {
    const base = [
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      2.8,
      10,
      5.6,
    ] as unknown[];

    const scaled = multiplyRadiusExpression(base, 2.5);

    expect(scaled[0]).toBe('interpolate');
    expect(scaled[4]).toBe(7);
    expect(scaled[6]).toBe(14);
  });

  it('wraps compound point radius expressions with a numeric scale', () => {
    const brandScaledPoint = [
      '*',
      ['interpolate', ['linear'], ['zoom'], 4, 2.8, 10, 5.6],
      ['case', ['==', ['get', 'brand'], 'primary'], 1.2, 1],
    ] as unknown[];

    const scaled = multiplyRadiusExpression(brandScaledPoint, 2.5);
    expect(scaled[0]).toBe('case');
    expect(scaled[1]).toEqual(['==', ['get', 'brand'], 'primary']);
    expect(scaled[2][0]).toBe('interpolate');
    expect(scaled[2][4]).toBeCloseTo(8.4, 5);
    expect(scaled[3][0]).toBe('interpolate');
    expect(scaled[3][4]).toBeCloseTo(7, 5);
  });
});
