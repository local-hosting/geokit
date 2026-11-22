import { describe, expect, it } from 'vitest';

import {
  coreGkH3PaintForTheme,
  outerRegionGkH3PaintForTheme,
} from '../../../src/utils/gk-h3-scope-paint';

describe('gk-h3-scope-paint', () => {
  it('uses orange for saved committed scope (not locker accent)', () => {
    const core = coreGkH3PaintForTheme('light', '#8e44ad');
    expect(core.color).toBe('#fb923c');
    expect(core.strokeColor).toBe('#ea580c');
    expect(core.opacity).toBeGreaterThan(0);
    const outer = outerRegionGkH3PaintForTheme('light', '#8e44ad');
    expect(outer.color).toBe('#fb923c');
    expect(outer.strokeColor).toBe('#ea580c');
    expect(outer.opacity).toBeLessThan(core.opacity);
  });
});