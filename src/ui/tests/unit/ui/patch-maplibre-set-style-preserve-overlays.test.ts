import { describe, expect, it, vi } from 'vitest';

import { patchMapLibreSetStyleToPreserveOverlays } from '../../../src/utils/map-surface/patch-maplibre-set-style-preserve-overlays';

describe('patchMapLibreSetStyleToPreserveOverlays', () => {
  it('wraps map.setStyle so object theme swaps keep venue overlays', () => {
    const previous = {
      sources: {
        'canvas-places': {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        },
      },
      layers: [{ id: 'canvas-places-point', type: 'circle', source: 'canvas-places' }],
    };
    const setStyle = vi.fn();
    const map = {
      getStyle: () => previous,
      setStyle,
    };
    patchMapLibreSetStyleToPreserveOverlays(map);
    map.setStyle(
      {
        version: 8,
        sources: { basemap: { type: 'vector' } },
        layers: [{ id: 'water', type: 'fill', source: 'basemap' }],
      },
      { transformStyle: vi.fn() },
    );
    expect(setStyle).toHaveBeenCalledTimes(1);
    const [style] = setStyle.mock.calls[0] as [Record<string, unknown>];
    expect((style.sources as Record<string, unknown>)['canvas-places']).toBeTruthy();
    patchMapLibreSetStyleToPreserveOverlays(map);
    map.setStyle({ version: 8, sources: {}, layers: [] });
    expect(setStyle).toHaveBeenCalledTimes(2);
  });
});