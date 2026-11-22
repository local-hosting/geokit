import { describe, expect, it } from 'vitest';

import {
  tentativeInnerGkH3PaintForTheme,
  tentativeOuterGkH3PaintForTheme,
} from '../../../src/utils/gk-h3-scope-paint';

describe('tentative gk-h3 scope paint', () => {
  it('uses neutral gray for save-preview hexes', () => {
    const inner = tentativeInnerGkH3PaintForTheme('light');
    expect(inner.strokeColor).toBe('#a3a3a3');
    expect(inner.opacity).toBeGreaterThan(0.4);
    const outer = tentativeOuterGkH3PaintForTheme('dark');
    expect(outer.strokeColor).toBe('#737373');
  });
});