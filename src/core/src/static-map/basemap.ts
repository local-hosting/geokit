/**
 * Snapshot URL defaults. Public style and tile CDN helpers live in
 * `@doppler-group/geokit/ui/config/map-style` and `@doppler-group/geokit/ui/config/tile-cdn`.
 */
import { firstEnv, readRuntimeEnv } from '@doppler-group/geokit/env/primitives';
import type { GeokitEnv } from '@doppler-group/geokit/env';
import { MAP_STYLE_URL_KEYS, TILE_API_URL_KEYS } from '@doppler-group/geokit/env';

const DEFAULT_MAPBOX_STYLE_URI = 'mapbox://styles/mapbox/streets-v12';
const DEFAULT_MAPTILER_API = 'https://api.maptiler.com/';

function mapboxStyleUriToStaticStyle(styleUri: string): string {
  const prefix = 'mapbox://styles/';
  if (styleUri.startsWith(prefix)) {
    return styleUri.slice(prefix.length);
  }
  return styleUri;
}

export function resolveMapboxStaticStyle(env: GeokitEnv = readRuntimeEnv()): string {
  const explicit = firstEnv(env, MAP_STYLE_URL_KEYS);
  return mapboxStyleUriToStaticStyle(explicit || DEFAULT_MAPBOX_STYLE_URI);
}

export function resolveMaptilerStaticMapsBase(env: GeokitEnv = readRuntimeEnv()): string {
  const raw = firstEnv(env, TILE_API_URL_KEYS)?.trim() || DEFAULT_MAPTILER_API;
  const api = (raw.endsWith('/') ? raw : `${raw}/`).replace(/\/$/, '');
  return `${api}/maps`;
}
