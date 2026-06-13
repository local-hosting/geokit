import type { Bounds } from '@twinfile/geokit/types';
import { normalizeCountyFips } from '../cdn/county.js';
import { resolveMapHostBaseUrlFromEnv } from '../config/env/index.js';
import type {
  MapHostPoint,
  MapHostRegionLayer,
  MapStyleId,
  MapViewport,
} from '../types/mcp-map.js';
import type { MapViewInput } from '../types/mcp-map.js';
import { zillowUrlFromListingName } from './listing-zillow-url.js';

function encodeBase64Url(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf8');
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type CompactMapHostPoint = {
  la: number;
  ln: number;
  i?: string;
  n?: string;
  c?: string;
  u?: string;
};

export function serializeMapHostPoints(points: MapHostPoint[]): string {
  const compact: CompactMapHostPoint[] = points.map((point) => ({
    la: point.lat,
    ln: point.lng,
    ...(point.id ? { i: point.id } : {}),
    ...(point.name ? { n: point.name } : {}),
    ...(point.color ? { c: point.color } : {}),
    ...(point.url ? { u: point.url } : {}),
  }));
  return encodeBase64Url(JSON.stringify(compact));
}

export function parseMapHostPoints(raw: string | null | undefined): MapHostPoint[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(decodeBase64Url(raw.trim())) as CompactMapHostPoint[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => Number.isFinite(row.la) && Number.isFinite(row.ln))
      .map((row) => ({
        lat: row.la,
        lng: row.ln,
        id: row.i,
        name: row.n,
        color: row.c,
        url: row.u?.trim() || zillowUrlFromListingName(row.n),
      }));
  } catch {
    return [];
  }
}

export const DEFAULT_MAP_HOST_URL = 'http://localhost:3002';

/** Path served by `yarn map-host` (Vite root: src/mcp/host/). */
export const MAP_HOST_PATH = '/index.html';

export function resolveMapHostBaseUrl(): string {
  return resolveMapHostBaseUrlFromEnv();
}

export function serializeMapHostBounds(bounds: Bounds): string {
  return bounds.map((value) => String(value)).join(',');
}

export function parseMapHostBounds(raw: string | null | undefined): Bounds | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return parts as Bounds;
}

export function applyMapHostRegionLayerParams(
  url: URL,
  regionLayer: MapHostRegionLayer | undefined
): void {
  if (!regionLayer) return;

  url.searchParams.set('regionDataset', regionLayer.dataset);

  switch (regionLayer.dataset) {
    case 'dma':
      if ('mode' in regionLayer && regionLayer.mode === 'viewport') {
        url.searchParams.set('regionMode', 'viewport');
      } else if ('slug' in regionLayer) {
        url.searchParams.set('regionSlug', regionLayer.slug.trim().toLowerCase());
        if (regionLayer.region?.trim()) {
          url.searchParams.set('dmaRegion', regionLayer.region.trim().toLowerCase());
        }
      }
      break;
    case 'state':
    case 'zip':
      url.searchParams.set('regionSlug', regionLayer.slug.trim().toLowerCase());
      break;
    case 'place':
      url.searchParams.set('regionState', regionLayer.state.trim().toLowerCase());
      url.searchParams.set('regionSlug', regionLayer.slug.trim().toLowerCase());
      break;
    case 'county':
      url.searchParams.set('regionFips', normalizeCountyFips(regionLayer.fips));
      break;
    default: {
      const _exhaustive: never = regionLayer;
      throw new Error(`Unsupported region dataset: ${String(_exhaustive)}`);
    }
  }
}

export function parseMapHostRegionLayer(
  params: Pick<URLSearchParams, 'get'>
): MapHostRegionLayer | null {
  const dataset = params.get('regionDataset')?.trim().toLowerCase();
  if (dataset === 'dma') {
    const regionMode = params.get('regionMode')?.trim().toLowerCase();
    if (regionMode === 'viewport') return { dataset: 'dma', mode: 'viewport' };
    const slug = params.get('regionSlug')?.trim().toLowerCase();
    if (!slug) return null;
    const region = params.get('dmaRegion')?.trim().toLowerCase();
    return region ? { dataset: 'dma', slug, region } : { dataset: 'dma', slug };
  }
  if (dataset === 'state' || dataset === 'zip') {
    const slug = params.get('regionSlug')?.trim().toLowerCase();
    return slug ? { dataset, slug } : null;
  }
  if (dataset === 'place') {
    const state = params.get('regionState')?.trim().toLowerCase();
    const slug = params.get('regionSlug')?.trim().toLowerCase();
    return state && slug ? { dataset: 'place', state, slug } : null;
  }
  if (dataset === 'county') {
    const fips = params.get('regionFips')?.trim();
    return fips ? { dataset: 'county', fips: normalizeCountyFips(fips) } : null;
  }

  const dmaSlug = params.get('dmaSlug')?.trim().toLowerCase();
  if (dmaSlug) return { dataset: 'dma', slug: dmaSlug };

  const placeState = params.get('placeState')?.trim().toLowerCase();
  const placeSlug = params.get('placeSlug')?.trim().toLowerCase();
  if (placeState && placeSlug) return { dataset: 'place', state: placeState, slug: placeSlug };

  return null;
}

export function regionLayerFromMapViewInput(input: MapViewInput): MapHostRegionLayer | undefined {
  if (input.regionLayer) return input.regionLayer;

  if (input.countyFips?.trim()) {
    return { dataset: 'county', fips: normalizeCountyFips(input.countyFips) };
  }
  if (input.state?.trim() && input.place?.trim()) {
    return {
      dataset: 'place',
      state: input.state.trim().toLowerCase(),
      slug: input.place.trim().toLowerCase(),
    };
  }
  return undefined;
}

export function buildMapHostUrl(args: {
  hostBaseUrl?: string;
  viewport: MapViewport;
  style?: MapStyleId;
  theme?: 'light' | 'dark';
  provider?: string;
  dmaSlug?: string;
  placeState?: string;
  placeSlug?: string;
  bounds?: Bounds;
  regionLayer?: MapHostRegionLayer;
  points?: MapHostPoint[];
}): string {
  const base = (args.hostBaseUrl ?? resolveMapHostBaseUrl()).replace(/\/$/, '');
  const url = new URL(`${base}${MAP_HOST_PATH}`);
  url.searchParams.set('lat', String(args.viewport.lat));
  url.searchParams.set('lng', String(args.viewport.lng));
  url.searchParams.set('zoom', String(args.viewport.zoom));
  if (args.style) {
    url.searchParams.set('style', args.style);
  }
  if (args.theme) {
    url.searchParams.set('theme', args.theme);
  }
  if (args.provider) {
    url.searchParams.set('provider', args.provider);
  }
  if (args.dmaSlug?.trim()) {
    url.searchParams.set('dmaSlug', args.dmaSlug.trim());
  }
  if (args.placeState?.trim() && args.placeSlug?.trim()) {
    url.searchParams.set('placeState', args.placeState.trim().toLowerCase());
    url.searchParams.set('placeSlug', args.placeSlug.trim().toLowerCase());
  }
  if (args.bounds?.length === 4) {
    url.searchParams.set('bounds', serializeMapHostBounds(args.bounds));
  }
  applyMapHostRegionLayerParams(url, args.regionLayer);
  if (args.points?.length) {
    url.searchParams.set('points', serializeMapHostPoints(args.points));
  }
  return url.toString();
}
