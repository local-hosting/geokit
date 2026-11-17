/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MapTilerUIProvider } from '../../../src/providers/maptiler-provider';

describe('MapTilerUIProvider createMap space/halo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('forces space and halo off so initSpace cannot addLayer before style load', async () => {
    const mapConstructor = vi.fn(function Map(this: { setStyle?: unknown }, options: unknown) {
      this.setStyle = vi.fn();
      return options;
    });

    const provider = new MapTilerUIProvider();
    (provider as { sdk: unknown }).sdk = {
      Map: mapConstructor,
      config: { caching: false, session: false },
    };
    (provider as { config: unknown }).config = { apiKey: 'test-key' };

    await provider.createMap(document.createElement('div'), {
      style: 'https://example.com/basemap',
      lat: 0,
      lng: 0,
      zoom: 2,
      // Attempt to re-enable — provider must still force off after extras.
      extra: { space: true, halo: true },
    });

    expect(mapConstructor).toHaveBeenCalledTimes(1);
    const options = mapConstructor.mock.calls[0]?.[0] as {
      space: boolean;
      halo: boolean;
      terrain: boolean;
      logSDKVersion: boolean;
    };
    expect(options.space).toBe(false);
    expect(options.halo).toBe(false);
    expect(options.terrain).toBe(false);
    expect(options.logSDKVersion).toBe(false);
  });
});
