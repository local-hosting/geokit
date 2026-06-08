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
