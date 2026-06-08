/**
 * Globe CDN path helpers for geokit fetch.
 * Canonical schema: @twinfile/cdn/paths — parity tested in tests/cdn/paths.test.ts.
 */

const DEFAULT_COUNTRY = 'us';

function cdnUrl(...segments: string[]): string {
  return `/${segments.filter(Boolean).join('/')}`;
}

function globeCountryUrl(country: string = DEFAULT_COUNTRY, ...segments: string[]): string {
  return cdnUrl(country, ...segments);
}

export function globeCountyShapeUrl(fips: string, country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'county', fips);
}

export function globeCountiesBulkUrl(country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'indexes', 'counties.json');
}

export function globeStatesBulkUrl(country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'indexes', 'states.json');
}

export function globeStateCitiesBulkUrl(state: string, country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'state', state.toLowerCase(), 'cities');
}

export function globeStateCitiesCatalogUrl(
  state: string,
  country: string = DEFAULT_COUNTRY
): string {
  return globeCountryUrl(country, 'state', state.toLowerCase(), 'cities-index.json');
}

export function resolveGlobeCdnUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

export function countyShapeUrl(baseUrl: string, fips: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeCountyShapeUrl(fips));
}

export function countiesBulkUrl(baseUrl: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeCountiesBulkUrl());
}

export function statesBulkUrl(baseUrl: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeStatesBulkUrl());
}

export function stateCitiesBulkUrl(baseUrl: string, state: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeStateCitiesBulkUrl(state));
}

export function stateCitiesCatalogUrl(baseUrl: string, state: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeStateCitiesCatalogUrl(state));
}
