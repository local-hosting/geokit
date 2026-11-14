import { describe, expect, it } from 'vitest';

import {
  buildFoursquarePlacesSearchUrl,
  resolveFoursquarePlacesApiBase,
} from '../src/foursquare-places';
import { FOURSQUARE_PLACES_API_BASE } from '../src/types/foursquare-places';

describe('resolveFoursquarePlacesApiBase', () => {
  it('defaults to the public Places API host', () => {
    expect(resolveFoursquarePlacesApiBase()).toBe(FOURSQUARE_PLACES_API_BASE);
  });

  it('prefers an explicit baseUrl override', () => {
    expect(resolveFoursquarePlacesApiBase({ baseUrl: '/__geo/foursquare/' })).toBe(
      '/__geo/foursquare',
    );
  });

  it('reads FOURSQUARE_PLACES_API_BASE from env', () => {
    expect(
      resolveFoursquarePlacesApiBase({
        env: { FOURSQUARE_PLACES_API_BASE: 'https://proxy.example/fsq' },
      }),
    ).toBe('https://proxy.example/fsq');
  });

  it('uses fallbackBase before the public host', () => {
    expect(
      resolveFoursquarePlacesApiBase({ fallbackBase: '/__geo/foursquare/' }),
    ).toBe('/__geo/foursquare');
  });
});

describe('buildFoursquarePlacesSearchUrl', () => {
  it('uses the public host by default', () => {
    const url = buildFoursquarePlacesSearchUrl({ query: 'coffee' });
    expect(url.origin + url.pathname).toBe(`${FOURSQUARE_PLACES_API_BASE}/places/search`);
  });

  it('uses a same-origin proxy base when provided', () => {
    const url = buildFoursquarePlacesSearchUrl({
      query: 'Boston',
      baseUrl: 'http://localhost:5175/__geo/foursquare',
    });
    expect(url.toString()).toContain('http://localhost:5175/__geo/foursquare/places/search');
    expect(url.searchParams.get('query')).toBe('Boston');
  });
});
