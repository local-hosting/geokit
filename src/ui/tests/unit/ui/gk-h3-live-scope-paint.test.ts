import { describe, expect, it } from 'vitest';

import { liveScopeOuterGkH3PaintForTheme } from '../../../src/utils/gk-h3-scope-paint';

describe('live scope gk-h3 paint', () => {
  it('uses locker accent (not orange) for live pointer scope', () => {
    const accent = '#2271b3';
    const light = liveScopeOuterGkH3PaintForTheme('light', accent);
    expect(light.strokeColor).toBe(accent);
    expect(light.color).toBe(accent);
    expect(light.opacity).toBeGreaterThan(0.2);

    const dark = liveScopeOuterGkH3PaintForTheme('dark', accent);
    expect(dark.strokeColor).toBe(accent);
    expect(dark.color).toBe(accent);
  });
});