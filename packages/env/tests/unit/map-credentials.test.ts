import { describe, expect, it } from 'vitest';
import {
  resolveMapApiKeyFromEnv,
  resolveMapProviderIdFromEnv,
  resolveMapRefererFromEnv,
  resolveMapboxKeyFromEnv,
  resolveMaptilerKeyFromEnv,
} from '../../src/map-credentials.js';

describe('map-credentials', () => {
  it('resolves maptiler and mapbox keys from env', () => {
    expect(resolveMaptilerKeyFromEnv({ MAPTILER_KEY: 'mt-key' })).toBe('mt-key');
    expect(resolveMapboxKeyFromEnv({ MAPBOX_TOKEN: 'mb-key' })).toBe('mb-key');
  });

  it('chooses provider from hint and env keys', () => {
    expect(resolveMapProviderIdFromEnv({}, { providerHint: 'mapbox' })).toBe('mapbox');
    expect(resolveMapProviderIdFromEnv({ MAPTILER_KEY: 'mt' })).toBe('maptiler');
    expect(resolveMapProviderIdFromEnv({ MAPBOX_TOKEN: 'mb' })).toBe('mapbox');
  });

  it('throws for unknown provider values', () => {
    expect(() => resolveMapProviderIdFromEnv({ GEOKIT_MAP_PROVIDER: 'unknown' })).toThrow(
      'Unknown map provider'
    );
  });

  it('resolves api keys per provider with generic fallback', () => {
    const env = { GEOKIT_MAP_API_KEY: 'generic-key' };
    expect(resolveMapApiKeyFromEnv(env, 'maptiler')).toBe('generic-key');
    expect(resolveMapApiKeyFromEnv({ MAPBOX_TOKEN: 'mb' }, 'mapbox')).toBe('mb');
  });

  it('resolves referer from env or map host base url', () => {
    expect(resolveMapRefererFromEnv({ GEOKIT_MAP_REFERER: 'https://app.example.com' })).toBe(
      'https://app.example.com'
    );
    expect(resolveMapRefererFromEnv({}, 'https://maps.example.com/')).toBe('https://maps.example.com/');
  });
});
