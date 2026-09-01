/**
 * Basemap tile/style CDN — point MapLibre style and tile URLs at your own host.
 */

import {
  createMapTilerDevTransformRequest,
  type MapTilerTransformRequest,
} from './maptiler-dev-proxy';
import { firstEnv, readRuntimeEnv } from '@geokit/env/primitives';
import type { GeokitEnv } from '@geokit/env';
import { MAP_STYLE_URL_KEYS, TILE_API_URL_KEYS, TILE_CDN_URL_KEYS } from '@geokit/env';

export type TileCdnEnv = GeokitEnv;

const DEFAULT_MAPTILER_API = 'https://api.maptiler.com/';
const DEFAULT_MAPTILER_CDN = 'https://cdn.maptiler.com/';

/** Full MapLibre style.json URL (overrides built-in MapTiler style names). */
export function resolveMapStyleUrlFromEnv(env: TileCdnEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, MAP_STYLE_URL_KEYS);
}

/** Replace `https://api.maptiler.com/` (style + static API + TileJSON). */
export function resolveTileApiUrlFromEnv(env: TileCdnEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, TILE_API_URL_KEYS);
}

/** Replace `https://cdn.maptiler.com/` (raster/vector tile bytes). */
export function resolveTileCdnUrlFromEnv(env: TileCdnEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, TILE_CDN_URL_KEYS);
}

export function normalizeUrlPrefix(url: string | undefined, fallback: string): string {
  const raw = url?.trim() || fallback;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function resolveMaptilerApiPrefix(env: TileCdnEnv = readRuntimeEnv()): string {
  return normalizeUrlPrefix(resolveTileApiUrlFromEnv(env), DEFAULT_MAPTILER_API);
}

export function resolveMaptilerCdnPrefix(env: TileCdnEnv = readRuntimeEnv()): string {
  return normalizeUrlPrefix(resolveTileCdnUrlFromEnv(env), DEFAULT_MAPTILER_CDN);
}

/** Base for MapTiler static snapshot API: `{api}/maps`. */
export function resolveMaptilerStaticMapsBase(env: TileCdnEnv = readRuntimeEnv()): string {
  const api = resolveMaptilerApiPrefix(env).replace(/\/$/, '');
  return `${api}/maps`;
}

export function buildMaptilerStyleUrl(
  styleName: string,
  apiKey: string,
  env: TileCdnEnv = readRuntimeEnv()
): string {
  const explicit = resolveMapStyleUrlFromEnv(env);
  if (explicit) return explicit;

  const api = resolveMaptilerApiPrefix(env).replace(/\/$/, '');
  return `${api}/maps/${styleName}/style.json?key=${encodeURIComponent(apiKey)}`;
}

/** Rewrite embedded MapTiler tile/style URLs when custom tile CDN prefixes are set. */
export function createTileCdnTransformFromEnv(
  env: TileCdnEnv = readRuntimeEnv()
): MapTilerTransformRequest | undefined {
  if (!resolveTileApiUrlFromEnv(env) && !resolveTileCdnUrlFromEnv(env)) {
    return undefined;
  }

  return createMapTilerDevTransformRequest({
    enabled: true,
    apiPrefix: DEFAULT_MAPTILER_API,
    cdnPrefix: DEFAULT_MAPTILER_CDN,
    proxyApiPrefix: resolveMaptilerApiPrefix(env),
    proxyCdnPrefix: resolveMaptilerCdnPrefix(env),
  });
}

export function tileCdnConfigured(env: TileCdnEnv = readRuntimeEnv()): boolean {
  return Boolean(
    resolveMapStyleUrlFromEnv(env) || resolveTileApiUrlFromEnv(env) || resolveTileCdnUrlFromEnv(env)
  );
}
