import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_HOST_URL,
  resolveFoursquareApiKey,
  resolveGeocodingApiKey,
  resolveGooglePlacesApiKey,
  resolveMapHostBaseUrlFromEnv,
  resolveRoutingAccessToken,
} from '../../../../src/config/env/service-keys.js';

describe('service-keys', () => {
  it('resolves geocoding and routing keys from env aliases', () => {
    const env = {
      GEOKIT_MAPTILER_KEY: 'maptiler-key',
      MAPBOX_TOKEN: 'mapbox-token',
    };
    expect(resolveGeocodingApiKey(env)).toBe('maptiler-key');
    expect(resolveRoutingAccessToken(env)).toBe('mapbox-token');
  });

  it('resolves provider-specific keys', () => {
    const env = {
      GOOGLE_PLACES_API_KEY: 'google-key',
      FOURSQUARE_API_KEY: 'fsq-key',
    };
    expect(resolveGooglePlacesApiKey(env)).toBe('google-key');
    expect(resolveFoursquareApiKey(env)).toBe('fsq-key');
  });

  it('falls back to default map host url and strips trailing slash', () => {
    expect(resolveMapHostBaseUrlFromEnv({})).toBe(DEFAULT_MAP_HOST_URL);
    expect(resolveMapHostBaseUrlFromEnv({ GEOKIT_MAP_HOST_URL: 'https://maps.example.com/' })).toBe(
      'https://maps.example.com'
    );
  });
});
