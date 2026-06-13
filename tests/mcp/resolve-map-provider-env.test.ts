// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultInteractiveMapStyle,
  resolveInteractiveMapCredentials,
  resolveMapProviderIdFromEnv,
} from '../../src/mcp/resolve-map-provider-env.js';

const ENV_KEYS = [
  'GEOKIT_MAP_PROVIDER',
  'MAP_PROVIDER',
  'GEOKIT_MAP_API_KEY',
  'MAP_API_KEY',
  'MAPTILER_KEY',
  'GEOKIT_MAPTILER_KEY',
  'MAPBOX_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'GEOKIT_MAPBOX_KEY',
] as const;

function clearMapEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('resolveMapProviderIdFromEnv', () => {
  afterEach(() => {
    clearMapEnv();
  });

  it('prefers provider query hint over env auto-detect', () => {
    process.env.MAPTILER_KEY = 'maptiler-key';
    process.env.MAPBOX_TOKEN = 'mapbox-token';

    expect(resolveMapProviderIdFromEnv(process.env, { providerHint: 'mapbox' })).toBe('mapbox');
  });

  it('resolves interactive credentials for mapbox hint', () => {
    process.env.MAPBOX_TOKEN = 'mapbox-token';

    const config = resolveInteractiveMapCredentials(process.env, {
      providerHint: 'mapbox',
    });

    expect(config.providerId).toBe('mapbox');
    expect(config.mapboxAccessToken).toBe('mapbox-token');
    expect(defaultInteractiveMapStyle('maptiler', {})).toBe('dataviz-dark');
    expect(defaultInteractiveMapStyle('mapbox', {})).toBe('dark-v11');
    expect(
      resolveInteractiveMapCredentials(
        { GEOKIT_MAP_STYLE_URL: 'https://tiles.example.com/style.json' },
        { providerHint: 'maptiler' }
      ).styleUrl
    ).toBe('https://tiles.example.com/style.json');
  });
});
