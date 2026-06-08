import { stateCitiesBulkUrl, stateCitiesCatalogUrl } from './paths';
import type { GlobeCdnFetchOptions } from './fetch';
import { fetchGlobeCdnJson } from './fetch';
import { resolveGlobeCdnBaseUrl } from './config';

export type StatePlaceCatalogEntry = {
  slug: string;
  name?: string;
  geoid?: string;
};

type StatePlaceCatalog = {
  entries?: StatePlaceCatalogEntry[];
};

const catalogCache = new Map<string, StatePlaceCatalogEntry[]>();
const citiesBulkCache = new Map<string, GeoJSON.FeatureCollection>();

function normalizeState(state: string): string {
  return state.trim().toLowerCase();
}

function normalizePlaceSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export async function fetchStatePlaceCatalog(
  stateCode: string,
  options?: GlobeCdnFetchOptions
): Promise<StatePlaceCatalogEntry[]> {
  const state = normalizeState(stateCode);
  const cached = catalogCache.get(state);
  if (cached) return cached;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const catalogUrl = stateCitiesCatalogUrl(base, state);
  const catalog = await fetchGlobeCdnJson<StatePlaceCatalog>(catalogUrl, options);
  const entries: StatePlaceCatalogEntry[] = [];
  for (const entry of catalog?.entries ?? []) {
    const slug = entry.slug?.trim().toLowerCase() ?? '';
    if (!slug) continue;
    entries.push({ slug, name: entry.name, geoid: entry.geoid });
  }

  catalogCache.set(state, entries);
  return entries;
}

export async function findStatePlaceEntry(
  stateCode: string,
  placeSlug: string,
  options?: GlobeCdnFetchOptions
): Promise<StatePlaceCatalogEntry | null> {
  const state = normalizeState(stateCode);
  const slug = normalizePlaceSlug(placeSlug);
  const catalog = await fetchStatePlaceCatalog(state, options);
  return (
    catalog.find((entry) => entry.slug === slug) ??
    catalog.find((entry) => entry.name?.trim().toLowerCase() === slug) ??
    null
  );
}

export async function fetchStateCitiesGeoJson(
  stateCode: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.FeatureCollection | null> {
  const state = normalizeState(stateCode);
  const cached = citiesBulkCache.get(state);
  if (cached) return cached;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const bulkUrl = stateCitiesBulkUrl(base, state);
  const geojson = await fetchGlobeCdnJson<GeoJSON.FeatureCollection>(bulkUrl, options);
  if (geojson?.type !== 'FeatureCollection' || !geojson.features?.length) {
    return null;
  }
  citiesBulkCache.set(state, geojson);
  return geojson;
}

function featureMatchesPlace(feature: GeoJSON.Feature, entry: StatePlaceCatalogEntry): boolean {
  const props = feature.properties as { slug?: string; geoid?: string; name?: string } | null;
  const slug = props?.slug?.trim().toLowerCase();
  if (slug && slug === entry.slug) return true;
  if (entry.geoid && String(props?.geoid ?? '') === entry.geoid) return true;
  if (entry.name && props?.name?.trim().toLowerCase() === entry.name.trim().toLowerCase()) {
    return true;
  }
  return false;
}

export async function fetchStatePlaceFeature(
  stateCode: string,
  placeSlug: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const entry = await findStatePlaceEntry(stateCode, placeSlug, options);
  if (!entry) return null;

  const collection = await fetchStateCitiesGeoJson(stateCode, options);
  if (!collection) return null;

  const feature = collection.features.find((f) => featureMatchesPlace(f, entry));
  return feature?.geometry ? feature : null;
}
