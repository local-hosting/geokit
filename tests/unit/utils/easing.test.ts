import { describe, it, expect } from 'vitest';
import { easeInOutCubic, easeLinear } from '../../../src/utils/easing';

describe('easing', () => {
  it('easeInOutCubic hits endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it('easeLinear clamps input', () => {
    expect(easeLinear(-1)).toBe(0);
    expect(easeLinear(2)).toBe(1);
    expect(easeLinear(0.25)).toBe(0.25);
  });
});
