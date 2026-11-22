import { GeoCache, GKH3 } from '@local-hosting/geokit/core';
import { compactH3CellId, expandH3CellId } from '@local-hosting/geokit/h3/lite';
import { getResolution } from 'h3-js';

import { crosswalk } from './crosswalk';
import { loadUsCrosswalkSync } from '../load/load';
import { slugToDmaDisplayName } from '../us/dma-labels';

/** Coarse H3 (country-scale) → country name only. */
export const H3_SCOPE_COUNTRY_MAX_RES = 2;
/** Fine H3 (city / market scale) → DMA or locality-style label. */
export const H3_SCOPE_MARKET_MIN_RES = 4;

export type H3ScopeLabelHit = {
  label: string;
  shortTitle: string;
  source: 'crosswalk';
};

let labelCache: GeoCache<H3ScopeLabelHit> | null = null;

function scopeLabelCache(): GeoCache<H3ScopeLabelHit> {
  if (!labelCache) {
    labelCache = new GeoCache({
      name: 'LocalH3ScopeLabel',
      maxEntries: 512,
      ttlMs: 0,
    });
  }
  return labelCache;
}

/** Test-only — clear session cache between cases. */
export function resetH3ScopeLabelCache(): void {
  labelCache?.clear();
  labelCache = null;
}

/** First segment of a geo scope label ("Chattanooga, Tennessee" → "Chattanooga"). */
export function h3ScopeShortTitle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '';
  const comma = trimmed.indexOf(',');
  return comma === -1 ? trimmed : trimmed.slice(0, comma).trim();
}

function stateAbbrevDisplay(abbr: string): string {
  return abbr.trim().toUpperCase();
}

function computeLocalH3ScopeLabel(expandedCell: string): string | null {
  loadUsCrosswalkSync();
  const resolution = getResolution(expandedCell);
  const result = crosswalk(GKH3(expandedCell));
  if (resolution <= H3_SCOPE_COUNTRY_MAX_RES) {
    return 'United States';
  }
  if (resolution < H3_SCOPE_MARKET_MIN_RES) {
    const state = result.state?.[0];
    return state ? stateAbbrevDisplay(state) : null;
  }
  const dma = result.dma?.[0];
  const state = result.state?.[0];
  if (dma) {
    const market = slugToDmaDisplayName(dma.slug);
    return state ? `${market}, ${stateAbbrevDisplay(state)}` : market;
  }
  const stateOnly = result.state?.[0];
  return stateOnly ? stateAbbrevDisplay(stateOnly) : null;
}

/**
 * Local-first H3 scope label — US crosswalk tables only (no geocoder).
 * Results are cached per compact H3 index for pan/zoom reuse.
 */
export function h3ScopeLabel(cell: string): H3ScopeLabelHit | null {
  const trimmed = cell.trim();
  if (!trimmed) return null;
  let key: string;
  try {
    key = compactH3CellId(expandH3CellId(trimmed));
  } catch {
    return null;
  }
  const cached = scopeLabelCache().get(key);
  if (cached) return cached;

  try {
    const expanded = expandH3CellId(key);
    const label = computeLocalH3ScopeLabel(expanded);
    if (!label) return null;
    const hit: H3ScopeLabelHit = {
      label,
      shortTitle: h3ScopeShortTitle(label),
      source: 'crosswalk',
    };
    scopeLabelCache().set(key, hit);
    return hit;
  } catch {
    return null;
  }
}