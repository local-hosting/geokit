import type { GlobeCdnFetchOptions } from './fetch';
import { fetchGlobeCdnJson } from './fetch';
import { resolveGlobeCdnBaseUrl } from './config';
import { countiesBulkUrl, statesBulkUrl } from './paths';

let cachedCounties: GeoJSON.FeatureCollection | null = null;
let cachedStates: GeoJSON.FeatureCollection | null = null;
let inflightCounties: Promise<GeoJSON.FeatureCollection | null> | null = null;
let inflightStates: Promise<GeoJSON.FeatureCollection | null> | null = null;

function isFeatureCollection(value: unknown): value is GeoJSON.FeatureCollection {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as GeoJSON.FeatureCollection).type === 'FeatureCollection' &&
    Array.isArray((value as GeoJSON.FeatureCollection).features) &&
    (value as GeoJSON.FeatureCollection).features.length > 0
  );
}

async function loadBulkCollection(
  url: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.FeatureCollection | null> {
  const geojson = await fetchGlobeCdnJson<GeoJSON.FeatureCollection>(url, options);
  if (!isFeatureCollection(geojson)) return null;
  return geojson;
}

export function clearBoundaryOutlineCache(): void {
  cachedCounties = null;
  cachedStates = null;
  inflightCounties = null;
  inflightStates = null;
}

export async function fetchCountiesBulkGeoJson(
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.FeatureCollection | null> {
  if (cachedCounties) return cachedCounties;
  if (inflightCounties) return inflightCounties;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const url = countiesBulkUrl(base);

  inflightCounties = loadBulkCollection(url, options).then((geojson) => {
    if (geojson) cachedCounties = geojson;
    return geojson;
  });

  try {
    return await inflightCounties;
  } finally {
    inflightCounties = null;
  }
}

export async function fetchStatesBulkGeoJson(
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.FeatureCollection | null> {
  if (cachedStates) return cachedStates;
  if (inflightStates) return inflightStates;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const url = statesBulkUrl(base);

  inflightStates = loadBulkCollection(url, options).then((geojson) => {
    if (geojson) cachedStates = geojson;
    return geojson;
  });

  try {
    return await inflightStates;
  } finally {
    inflightStates = null;
  }
}

/** Warm `/us/indexes/states.json` (state namespace). */
export function prefetchStateBoundaries(options?: GlobeCdnFetchOptions): void {
  void fetchStatesBulkGeoJson(options);
}

/** Warm `/us/indexes/counties.json` (county namespace). */
export function prefetchCountyBoundaries(options?: GlobeCdnFetchOptions): void {
  void fetchCountiesBulkGeoJson(options);
}

/** Start outline downloads (module cache shared across callers). */
export function prefetchBoundaryOutlines(
  options?: GlobeCdnFetchOptions & { counties?: boolean }
): void {
  prefetchStateBoundaries(options);
  if (options?.counties === true) prefetchCountyBoundaries(options);
}
