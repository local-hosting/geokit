import type { DmaMarketCatalogIndex } from '../types/dma.js';
import { canonicalDmaCdnSlug } from './dma-slug.js';
import type { GlobeCdnFetchOptions } from './fetch.js';
import { fetchGlobeCdnJson } from './fetch.js';
import { resolveGlobeCdnBaseUrl } from './config.js';
import { dmaMarketIndexUrl } from './paths.js';

export type DmaCatalogSlugMatch =
  | { kind: 'exact'; slug: string }
  | { kind: 'prefix'; slug: string }
  | { kind: 'ambiguous'; slugs: string[] }
  | { kind: 'none' };

let cachedCatalog: DmaMarketCatalogIndex | null | undefined;

function normalizeHint(hint: string): string {
  return canonicalDmaCdnSlug(
    hint
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/** Match a short DMA hint against published Nielsen slugs. */
export function matchDmaSlugInCatalog(
  hint: string,
  catalogSlugs: readonly string[]
): DmaCatalogSlugMatch {
  const normalized = normalizeHint(hint);
  if (!normalized) return { kind: 'none' };

  const slugs = [
    ...new Set(catalogSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean)),
  ].sort();
  if (slugs.length === 0) return { kind: 'none' };

  const exact = slugs.find(
    (slug) => slug === normalized || canonicalDmaCdnSlug(slug) === normalized
  );
  if (exact) return { kind: 'exact', slug: exact };

  const prefixMatches = slugs.filter(
    (slug) =>
      slug === normalized || slug.startsWith(`${normalized}-`) || slug.startsWith(`${normalized}_`)
  );
  if (prefixMatches.length === 1) return { kind: 'prefix', slug: prefixMatches[0]! };
  if (prefixMatches.length > 1) return { kind: 'ambiguous', slugs: prefixMatches };

  return { kind: 'none' };
}

export function formatDmaCatalogSuggestions(match: DmaCatalogSlugMatch): string[] {
  if (match.kind === 'ambiguous') return match.slugs.slice(0, 5);
  return [];
}

export async function fetchDmaMarketCatalog(
  options?: GlobeCdnFetchOptions
): Promise<DmaMarketCatalogIndex | null> {
  if (cachedCatalog !== undefined) return cachedCatalog;

  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const catalog = await fetchGlobeCdnJson<DmaMarketCatalogIndex>(dmaMarketIndexUrl(base), options);
  cachedCatalog = catalog?.entries?.length ? catalog : null;
  return cachedCatalog;
}

export function clearDmaMarketCatalogCache(): void {
  cachedCatalog = undefined;
}

export async function resolveDmaCatalogSlug(
  hint: string,
  options?: GlobeCdnFetchOptions
): Promise<DmaCatalogSlugMatch> {
  const catalog = await fetchDmaMarketCatalog(options);
  if (!catalog?.entries?.length) return { kind: 'none' };
  return matchDmaSlugInCatalog(
    hint,
    catalog.entries.map((entry) => entry.slug)
  );
}

export type ResolvedDmaMarketCatalogEntry = {
  slug: string;
  region?: string;
};

function catalogEntryForSlug(
  catalog: DmaMarketCatalogIndex,
  slug: string
): ResolvedDmaMarketCatalogEntry | null {
  const normalized = slug.trim().toLowerCase();
  const entry = catalog.entries.find((item) => item.slug.trim().toLowerCase() === normalized);
  if (!entry) return null;
  return {
    slug: entry.slug.trim().toLowerCase(),
    region: entry.region?.trim().toLowerCase(),
  };
}

/** Resolve a DMA hint to canonical CDN slug + georef region from `/markets/dma/index.json`. */
export async function resolveDmaMarketFromCatalog(
  hint: string,
  options?: GlobeCdnFetchOptions
): Promise<ResolvedDmaMarketCatalogEntry | null> {
  const match = await resolveDmaCatalogSlug(hint, options);
  if (match.kind !== 'exact' && match.kind !== 'prefix') return null;

  const catalog = await fetchDmaMarketCatalog(options);
  if (!catalog) return { slug: match.slug };

  return catalogEntryForSlug(catalog, match.slug) ?? { slug: match.slug };
}

export async function lookupDmaRegionForSlug(
  slug: string,
  options?: GlobeCdnFetchOptions
): Promise<string | undefined> {
  const resolved = await resolveDmaMarketFromCatalog(slug, options);
  return resolved?.region;
}
