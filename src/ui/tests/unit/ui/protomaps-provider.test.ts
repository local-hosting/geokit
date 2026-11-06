import { beforeEach, describe, expect, it, vi } from 'vitest';

const mapConstructor = vi.fn();
const addProtocol = vi.fn();

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options: unknown) {
      mapConstructor(options);
    }
  }
  class NavigationControl {}
  class ScaleControl {}
  class FullscreenControl {}
  class GeolocateControl {}
  class Marker {}
  class Popup {}
  return { Map, NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, Marker, Popup, addProtocol };
});

vi.mock('pmtiles', () => ({
  Protocol: class Protocol {
    tile = vi.fn();
  },
}));

vi.mock('@protomaps/basemaps', () => ({
  namedFlavor: (name: string) => ({ name }),
  layers: () => [{ id: 'background' }],
}));

import {
  buildPmtilesStyle,
  buildProtomapsHostedStyleUrl,
  protomapsFlavorForStyle,
  protomapsLabelLanguage,
  ProtomapsUIProvider,
  resetProtomapsProviderForTests,
} from '../../../src/providers/protomaps-provider';
import { _resetRegistries, configure } from '../../../src/providers/registry';

describe('protomaps style', () => {
  it('maps geokit theme names onto Protomaps flavors', () => {
    expect(protomapsFlavorForStyle('dataviz')).toBe('white');
    expect(protomapsFlavorForStyle('dataviz-dark')).toBe('black');
    expect(protomapsFlavorForStyle('streets')).toBe('light');
    expect(protomapsFlavorForStyle('dark')).toBe('dark');
    expect(protomapsFlavorForStyle('unknown-style')).toBe('light');
  });

  it('builds a hosted style URL and ignores unsafe language codes', () => {
    expect(protomapsLabelLanguage('EN')).toBe('en');
    expect(protomapsLabelLanguage('../x')).toBe('en');
    expect(buildProtomapsHostedStyleUrl('light', 'en', 'k ey')).toBe(
      'https://api.protomaps.com/styles/v5/light/en.json?key=k%20ey'
    );
  });

  it('builds a PMTiles style that points at the archive', () => {
    const style = buildPmtilesStyle(
      {
        namedFlavor: (name: string) => ({ name }),
        layers: () => [{ id: 'background' }],
      },
      'https://example.com/basemap.pmtiles',
      'dark',
      'en'
    );
    const sources = style.sources as { protomaps: { url: string } };
    expect(sources.protomaps.url).toBe('pmtiles://https://example.com/basemap.pmtiles');
    expect(style.sprite).toBe('https://protomaps.github.io/basemaps-assets/sprites/v4/dark');
  });
});

describe('ProtomapsUIProvider', () => {
  beforeEach(() => {
    mapConstructor.mockClear();
    addProtocol.mockClear();
    resetProtomapsProviderForTests();
    _resetRegistries();
  });

  it('creates a MapLibre map with the hosted style for the theme', async () => {
    const provider = new ProtomapsUIProvider();
    await provider.initialize({ apiKey: 'pm-key' });
    await provider.createMap(document.createElement('div'), {
      lat: 1,
      lng: 2,
      zoom: 3,
      style: 'dataviz-dark',
    });
    const options = mapConstructor.mock.calls[0][0] as { style: string; center: number[] };
    expect(options.style).toBe('https://api.protomaps.com/styles/v5/black/en.json?key=pm-key');
    expect(options.center).toEqual([2, 1]);
    expect(provider.getStyleForTheme('dataviz')).toBe(
      'https://api.protomaps.com/styles/v5/white/en.json?key=pm-key'
    );
  });

  it('uses a configured style URL and a PMTiles archive', async () => {
    configure({ protomaps: { pmtilesUrl: 'https://cdn.example/world.pmtiles', labelLanguage: 'fr' } });
    const provider = new ProtomapsUIProvider();
    await provider.initialize({});
    await provider.createMap(document.createElement('div'), { style: 'light' });
    expect(addProtocol).toHaveBeenCalledWith('pmtiles', expect.any(Function));
    const options = mapConstructor.mock.calls[0][0] as { style: { sources: { protomaps: { url: string } } } };
    expect(options.style.sources.protomaps.url).toBe('pmtiles://https://cdn.example/world.pmtiles');
    expect(provider.getStyleForTheme('dark')).toMatchObject({
      sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
    });
  });

  it('requires a key, style URL, or archive', async () => {
    const provider = new ProtomapsUIProvider();
    await provider.initialize({});
    await expect(provider.createMap(document.createElement('div'), {})).rejects.toThrow(/API key/);
  });
});
