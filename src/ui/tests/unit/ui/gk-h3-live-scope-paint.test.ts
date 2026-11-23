import { describe, expect, it } from 'vitest';

import {
  gkH3ScopeOuterStrokeColor,
  liveScopeInnerGkH3PaintForTheme,
  liveScopeOuterGkH3PaintForTheme,
} from '../../../src/utils/gk-h3-scope-paint';

describe('live scope gk-h3 paint', () => {
  it('uses locker accent (not orange) for live pointer scope', () => {
    const accent = '#2271b3';
    const light = liveScopeOuterGkH3PaintForTheme('light', accent);
    expect(light.color).toBe(accent);
    expect(light.strokeColor).toBe(gkH3ScopeOuterStrokeColor(accent));
    expect(light.opacity).toBeGreaterThan(0.2);

    const dark = liveScopeOuterGkH3PaintForTheme('dark', accent);
    expect(dark.color).toBe(accent);
    expect(dark.strokeColor).toBe(gkH3ScopeOuterStrokeColor(accent));
  });

  it('uses a semi-transparent stroke on live outer hex only', () => {
    const accent = '#2271b3';
    const outer = liveScopeOuterGkH3PaintForTheme('light', accent);
    const inner = liveScopeInnerGkH3PaintForTheme('light', accent);
    expect(outer.strokeWidth).toBeGreaterThan(0);
    expect(outer.strokeColor).toBe(gkH3ScopeOuterStrokeColor(accent));
    expect(inner.strokeWidth).toBe(0);
    expect(inner.color).toBe(outer.color);
    expect(inner.opacity).toBeGreaterThan(outer.opacity ?? 0);
  });
});