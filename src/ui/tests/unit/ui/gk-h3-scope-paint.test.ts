import { describe, expect, it } from 'vitest';

import {
  coreGkH3PaintForTheme,
  outerRegionGkH3PaintForTheme,
} from '../../../src/utils/gk-h3-scope-paint';

describe('gk-h3-scope-paint', () => {
  it('uses locker accent when valid', () => {
    const core = coreGkH3PaintForTheme('light', '#8e44ad');
    expect(core.color).toBe('#8e44ad');
    expect(core.strokeColor).toBe('#8e44ad');
    expect(core.opacity).toBeGreaterThan(0);
    const outer = outerRegionGkH3PaintForTheme('light', '#8e44ad');
    expect(outer.opacity).toBeLessThan(core.opacity);
  });
});