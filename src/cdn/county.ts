import type { GlobeCdnFetchOptions } from './fetch';
import { fetchGlobeCdnJson } from './fetch';
import { resolveGlobeCdnBaseUrl } from './config';
import { countyShapeUrl } from './paths';

export function normalizeCountyFips(fips: string): string {
  return String(fips).padStart(5, '0');
}

export async function fetchCountyShapeFeature(
  fips: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const normalized = normalizeCountyFips(fips);
  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const feature = await fetchGlobeCdnJson<GeoJSON.Feature>(
    countyShapeUrl(base, normalized),
    options
  );
  return feature?.geometry ? feature : null;
}

export function normalizeCountyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+(county|parish|borough)$/i, '');
}

export async function resolveUsCountyShapeFeature(
  countyName: string,
  stateHint: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const { resolveUsStateShapeFeature } = await import('./state.js');
  const stateFeature = await resolveUsStateShapeFeature(stateHint, options);
  const stateFips = String(
    (stateFeature?.properties as { stateFips?: string } | undefined)?.stateFips ?? ''
  ).padStart(2, '0');
  if (!stateFips) return null;

  const targetName = normalizeCountyName(countyName);
  const { fetchCountiesBulkGeoJson } = await import('./bulk.js');
  const bulk = await fetchCountiesBulkGeoJson(options);
  const match = bulk?.features.find((feature) => {
    const props = feature.properties as { fips?: string; name?: string } | undefined;
    const fips = String(props?.fips ?? '');
    const name = normalizeCountyName(String(props?.name ?? ''));
    return fips.startsWith(stateFips) && name === targetName;
  });

  if (match?.geometry) return match;

  const fips = match?.properties ? String((match.properties as { fips?: string }).fips ?? '') : '';
  if (fips) {
    return fetchCountyShapeFeature(fips, options);
  }

  return null;
}

export async function fetchCountyShapesForFips(
  fipsList: string[],
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature[]> {
  const unique = [...new Set(fipsList.map(normalizeCountyFips))];
  const features: GeoJSON.Feature[] = [];
  for (const fips of unique) {
    const feature = await fetchCountyShapeFeature(fips, options);
    if (feature) features.push(feature);
  }
  return features;
}
