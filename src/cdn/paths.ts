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

export function globeStateShapeUrl(state: string, country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'state', `${state.toLowerCase()}.json`);
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

export function stateShapeUrl(baseUrl: string, state: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeStateShapeUrl(state));
}

export function stateCitiesBulkUrl(baseUrl: string, state: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeStateCitiesBulkUrl(state));
}

export function globePlaceShapeUrl(
  state: string,
  placeSlug: string,
  country: string = DEFAULT_COUNTRY
): string {
  return globeCountryUrl(country, 'place', state.toLowerCase(), placeSlug.toLowerCase());
}

export function globeZipShapeUrl(zip: string, country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'zip', zip);
}

export function globeZipIndexUrl(country: string = DEFAULT_COUNTRY): string {
  return globeCountryUrl(country, 'zip', 'index.json');
}

export function stateCitiesCatalogUrl(baseUrl: string, state: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeStateCitiesCatalogUrl(state));
}

export function placeShapeUrl(baseUrl: string, state: string, placeSlug: string): string {
  return resolveGlobeCdnUrl(baseUrl, globePlaceShapeUrl(state, placeSlug));
}

export function zipShapeUrl(baseUrl: string, zip: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeZipShapeUrl(zip));
}

export function zipIndexUrl(baseUrl: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeZipIndexUrl());
}

export function globeDmaMarketShapePath(marketSlug: string): string {
  return `/markets/dma/${marketSlug.trim().toLowerCase()}.json`;
}

export function globeDmaMarketIndexPath(): string {
  return '/markets/dma/index.json';
}

export function globeDmaMarketBundlePath(): string {
  return '/markets/dma/all.json';
}

export function globeDmaRegionIndexPath(): string {
  return '/markets/dma/regions/index.json';
}

export function globeDmaRegionShardPath(regionId: string): string {
  return `/markets/dma/regions/${regionId.trim().toLowerCase()}.json`;
}

export function dmaMarketShapeUrl(baseUrl: string, marketSlug: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeDmaMarketShapePath(marketSlug));
}

export function dmaMarketIndexUrl(baseUrl: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeDmaMarketIndexPath());
}

export function dmaMarketBundleUrl(baseUrl: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeDmaMarketBundlePath());
}

export function dmaRegionIndexUrl(baseUrl: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeDmaRegionIndexPath());
}

export function dmaRegionShardUrl(baseUrl: string, regionId: string): string {
  return resolveGlobeCdnUrl(baseUrl, globeDmaRegionShardPath(regionId));
}
