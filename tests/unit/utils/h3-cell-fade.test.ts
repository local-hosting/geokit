import { describe, expect, it } from 'vitest';
import {
  H3_CELL_FADE_MS,
  anyH3CellsFading,
  h3CellFadeOpacity,
  h3CellFadeProgress,
} from '../../../src/utils/h3/cell-fade';

describe('h3 cell fade', () => {
  it('starts at new opacity and eases toward base', () => {
    const levels = { new: 0.28, base: 0.14 };
    const loadedAt = 1_000;
    expect(h3CellFadeProgress(loadedAt, loadedAt)).toBe(0);
    expect(h3CellFadeOpacity(loadedAt, levels, loadedAt)).toBe(levels.new);

    const mid = loadedAt + H3_CELL_FADE_MS / 2;
    const midOpacity = h3CellFadeOpacity(loadedAt, levels, mid);
    expect(midOpacity).toBeGreaterThan(levels.base);
    expect(midOpacity).toBeLessThan(levels.new);

    const end = loadedAt + H3_CELL_FADE_MS;
    expect(h3CellFadeOpacity(loadedAt, levels, end)).toBe(levels.base);
  });

  it('anyH3CellsFading respects getLoadedAt lookup', () => {
    const loadedAt = 5_000;
    const lookup = (id: string) => (id === 'abc' ? loadedAt : undefined);
    expect(anyH3CellsFading(['abc'], { getLoadedAt: lookup, nowMs: loadedAt + 100 })).toBe(true);
    expect(
      anyH3CellsFading(['abc'], { getLoadedAt: lookup, nowMs: loadedAt + H3_CELL_FADE_MS + 1 })
    ).toBe(false);
  });
});
