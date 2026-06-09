import type { GlobeCdnFetchOptions } from './fetch';
import { fetchGlobeCdnJson } from './fetch';
import { resolveGlobeCdnBaseUrl } from './config';
import { zipIndexUrl, zipShapeUrl } from './paths';

export type ZipCatalogEntry = {
  slug: string;
  name?: string;
  url?: string;
};

type ZipCatalogIndex = {
  version?: number;
  entries?: ZipCatalogEntry[];
};

const catalogCache: { entries: ZipCatalogEntry[] | null } = { entries: null };

function normalizeZip(zip: string): string {
  return zip.trim();
}

export async function fetchZipCatalog(options?: GlobeCdnFetchOptions): Promise<ZipCatalogEntry[]> {
  if (catalogCache.entries) return catalogCache.entries;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const catalog = await fetchGlobeCdnJson<ZipCatalogIndex>(zipIndexUrl(base), options);
  const entries: ZipCatalogEntry[] = [];
  for (const entry of catalog?.entries ?? []) {
    const slug = normalizeZip(entry.slug ?? '');
    if (!slug) continue;
    entries.push({ slug, name: entry.name, url: entry.url });
  }

  catalogCache.entries = entries;
  return entries;
}

export async function fetchZipFeature(
  zipCode: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const zip = normalizeZip(zipCode);
  if (!zip) return null;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const catalog = await fetchZipCatalog(options);
  const entry = catalog.find((item) => item.slug === zip);
  const url = entry?.url ?? zipShapeUrl(base, zip);
  const feature = await fetchGlobeCdnJson<GeoJSON.Feature>(url, options);
  return feature?.geometry ? feature : null;
}

export async function fetchZipFeatures(
  zipCodes: readonly string[],
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.FeatureCollection> {
  const features: GeoJSON.Feature[] = [];
  for (const zip of zipCodes) {
    const feature = await fetchZipFeature(zip, options);
    if (feature) features.push(feature);
  }
  return { type: 'FeatureCollection', features };
}

export function clearZipCatalogCache(): void {
  catalogCache.entries = null;
}
