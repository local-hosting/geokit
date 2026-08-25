import { describe, expect, it, vi } from 'vitest';
import {
  H3_CELL_FADE_MS,
  anyH3CellsFading,
  applyH3CellFadeToCollection,
  createH3FadeLoop,
  h3CellFadeOpacity,
  h3CellFadeProgress,
  h3CellFadeProperties,
} from '@geokit/h3';

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

  it('computes fade properties per cell', () => {
    const levels = { new: 0.4, base: 0.1 };
    const loadedAt = 1_000;
    const props = h3CellFadeProperties('abc', levels, levels, {
      getLoadedAt: () => loadedAt,
      nowMs: loadedAt,
    });
    expect(props.fillOpacity).toBe(levels.new);
    expect(props.lineOpacity).toBe(levels.new);
  });

  it('applies fade properties to a feature collection', () => {
    const levels = { new: 0.4, base: 0.1 };
    const collection: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { h3: 'abc' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const faded = applyH3CellFadeToCollection(collection, levels, levels, {
      getLoadedAt: () => 1_000,
      nowMs: 1_000,
    });
    expect(faded.features[0].properties?.fillOpacity).toBe(levels.new);
  });

  it('exposes fade loop controls without scheduling when nothing is fading', () => {
    const onTick = vi.fn();
    const loop = createH3FadeLoop(
      () => ['done'],
      onTick,
      { getLoadedAt: () => 0, nowMs: H3_CELL_FADE_MS + 1 }
    );
    loop.notifyUpdate();
    loop.stop();
    expect(onTick).not.toHaveBeenCalled();
  });
});
