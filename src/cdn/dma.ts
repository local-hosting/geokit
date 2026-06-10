import { resolveDmaCatalogSlug } from './dma-catalog.js';
import { canonicalDmaCdnSlug } from './dma-slug.js';
import type { GlobeCdnFetchOptions } from './fetch.js';
import { fetchGlobeCdnJson } from './fetch.js';
import { resolveGlobeCdnBaseUrl } from './config.js';
import { dmaMarketShapeUrl } from './paths.js';

function slugifyDmaHint(hint: string): string {
  return hint
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function dmaSlugFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const explicit =
    trimmed.match(/^\s*(.+?)\s+dma\s*$/i) ?? trimmed.match(/^\s*dma\s*[:\-]?\s*(.+?)\s*$/i);
  if (explicit?.[1]) {
    const slug = canonicalDmaCdnSlug(slugifyDmaHint(explicit[1]));
    return slug || null;
  }

  if (/\bdma\b/i.test(trimmed)) {
    const withoutDma = trimmed.replace(/\bdma\b/gi, ' ').trim();
    if (withoutDma) {
      const slug = canonicalDmaCdnSlug(slugifyDmaHint(withoutDma));
      return slug || null;
    }
  }

  return null;
}

type DmaMarketShapeRecord = {
  slug?: string;
  name?: string;
  geometry?: GeoJSON.Geometry;
};

type DmaMarketShapePayload =
  | GeoJSON.Feature
  | GeoJSON.FeatureCollection
  | DmaMarketShapeRecord
  | null;

function isGeoJsonFeature(payload: DmaMarketShapePayload): payload is GeoJSON.Feature {
  return Boolean(payload && 'type' in payload && payload.type === 'Feature');
}

function isGeoJsonFeatureCollection(
  payload: DmaMarketShapePayload
): payload is GeoJSON.FeatureCollection {
  return Boolean(payload && 'type' in payload && payload.type === 'FeatureCollection');
}

function isDmaMarketShapeRecord(payload: DmaMarketShapePayload): payload is DmaMarketShapeRecord {
  return Boolean(payload && !('type' in payload));
}

function featureFromDmaPayload(payload: DmaMarketShapePayload): GeoJSON.Feature | null {
  if (!payload) return null;
  if (isGeoJsonFeature(payload)) {
    return payload.geometry ? payload : null;
  }
  if (isGeoJsonFeatureCollection(payload)) {
    const feature = payload.features.find((item) => item.geometry);
    return feature ?? null;
  }
  if (isDmaMarketShapeRecord(payload) && payload.geometry) {
    return {
      type: 'Feature',
      properties: {
        slug: payload.slug,
        name: payload.name,
      },
      geometry: payload.geometry,
    };
  }
  return null;
}

export async function fetchDmaMarketShapeFeature(
  slug: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const normalized = canonicalDmaCdnSlug(slug);
  if (!normalized) return null;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const payload = await fetchGlobeCdnJson<DmaMarketShapePayload>(
    dmaMarketShapeUrl(base, normalized),
    options
  );
  return featureFromDmaPayload(payload);
}

export async function resolveDmaShapeFromQuery(
  query: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const slug = dmaSlugFromQuery(query);
  if (!slug) return null;

  const direct = await fetchDmaMarketShapeFeature(slug, options);
  if (direct) return direct;

  const match = await resolveDmaCatalogSlug(slug, options);
  if (match.kind === 'exact' || match.kind === 'prefix') {
    return fetchDmaMarketShapeFeature(match.slug, options);
  }

  return null;
}
