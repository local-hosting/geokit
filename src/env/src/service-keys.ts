import {
  FOURSQUARE_KEY_KEYS,
  HERE_KEY_KEYS,
  ESRI_KEY_KEYS,
  GOOGLE_PLACES_KEY_KEYS,
  MAP_HOST_URL_KEYS,
  MAPTILER_KEY_KEYS,
  MAPBOX_KEY_KEYS,
  MAP_GENERIC_API_KEY_KEYS,
  ROUTING_TOKEN_KEYS,
  type GeokitEnv,
} from './types/env';
import { firstEnv, readRuntimeEnv, stripTrailingSlash } from './primitives';

export const DEFAULT_MAP_HOST_URL = 'http://localhost:3002';

export function resolveGeocodingApiKey(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, MAP_GENERIC_API_KEY_KEYS) ?? firstEnv(env, MAPTILER_KEY_KEYS);
}

export function resolveRoutingAccessToken(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, ROUTING_TOKEN_KEYS) ?? firstEnv(env, MAPBOX_KEY_KEYS);
}

export function resolveGooglePlacesApiKey(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, GOOGLE_PLACES_KEY_KEYS);
}

export function resolveHereApiKey(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, HERE_KEY_KEYS);
}

export function resolveEsriApiKey(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, ESRI_KEY_KEYS);
}

export function resolveFoursquareApiKey(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, FOURSQUARE_KEY_KEYS);
}

export function resolveMapHostBaseUrlFromEnv(env: GeokitEnv = readRuntimeEnv()): string {
  const fromEnv = firstEnv(env, MAP_HOST_URL_KEYS) ?? DEFAULT_MAP_HOST_URL;
  return stripTrailingSlash(fromEnv);
}
