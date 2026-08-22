import { describe, expect, it } from 'vitest';
import { calculateFitBoundsViewport } from '../../../../src/utils/bounds/fit-viewport.js';

describe('calculateFitBoundsViewport', () => {
  it('fits Boston bounds into a 600x400 viewport', () => {
    const bounds: [number, number, number, number] = [-71.2, 42.2, -70.9, 42.4];
    const viewport = calculateFitBoundsViewport(bounds, 600, 400, 0.06);
    expect(viewport.lat).toBeGreaterThan(42);
    expect(viewport.lat).toBeLessThan(43);
    expect(viewport.lng).toBeLessThan(-70);
    expect(viewport.zoom).toBeGreaterThan(8);
    expect(viewport.zoom).toBeLessThan(14);
  });
});
