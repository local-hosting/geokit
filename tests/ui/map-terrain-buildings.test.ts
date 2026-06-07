import { afterEach, describe, expect, it } from 'vitest';
import {
  buildHillshadeRasterSource,
  buildTerrainDemSource,
} from '../../src/ui/components/elements/map/map-terrain-buildings';
import { configure } from '../../src/ui/providers/registry';

describe('map-terrain-buildings', () => {
  afterEach(() => {
    configure({ maptiler: { transformRequest: undefined } });
  });

  it('buildTerrainDemSource uses proxied tile templates when transformRequest is set', () => {
    configure({
      maptiler: {
        transformRequest: (url: string) => ({ url: `/proxy/${url}` }),
      },
    });

    const spec = buildTerrainDemSource({
      provider: 'maptiler',
      apiKey: 'test-key',
    });

    expect(spec.tiles).toEqual([
      '/proxy/https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=test-key',
    ]);
    expect(spec.url).toBeUndefined();
  });

  it('buildTerrainDemSource falls back to tiles.json without transformRequest', () => {
    const spec = buildTerrainDemSource({
      provider: 'maptiler',
      apiKey: 'test-key',
    });

    expect(spec.url).toBe('https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=test-key');
    expect(spec.tiles).toBeUndefined();
  });

  it('buildHillshadeRasterSource uses proxied tile templates when transformRequest is set', () => {
    configure({
      maptiler: {
        transformRequest: (url: string) => ({ url: `/proxy/${url}` }),
      },
    });

    const spec = buildHillshadeRasterSource(
      'test-key',
      'https://api.maptiler.com/tiles/hand-drawn-hillshade/tiles.json?key=test-key'
    );

    expect(spec.tiles).toEqual([
      '/proxy/https://api.maptiler.com/tiles/hand-drawn-hillshade/{z}/{x}/{y}.png?key=test-key',
    ]);
    expect(spec.url).toBeUndefined();
  });
});
