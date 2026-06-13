import { isGeoCdnConfiguredFromEnv, resolveGeoCdnBaseUrlFromEnv } from '../config/env/geo-cdn.js';
import type { GeokitEnv } from '../types/env.js';
import { readRuntimeEnv } from '../config/env/primitives.js';

/**
 * Geo boundary CDN base (county/DMA/zip shapes — not basemap tiles).
 * Returns empty string when unset so callers skip boundary layers.
 */
export function resolveGlobeCdnBaseUrl(baseUrl?: string): string {
  return resolveGeoCdnBaseUrlFromEnv(readRuntimeEnv(), baseUrl);
}

/** Alias — geo shape CDN, optional. */
export const resolveGeoCdnBaseUrl = resolveGlobeCdnBaseUrl;

export function isGeoCdnConfigured(baseUrl?: string): boolean {
  return isGeoCdnConfiguredFromEnv(readRuntimeEnv(), baseUrl);
}

/** Resolve geo CDN base from an explicit env snapshot (tests). */
export function resolveGlobeCdnBaseUrlFromEnvSnapshot(env: GeokitEnv, baseUrl?: string): string {
  return resolveGeoCdnBaseUrlFromEnv(env, baseUrl);
}
