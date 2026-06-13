import {
  GEO_CDN_JWT_KEYS,
  GEO_CDN_JWT_SECRET_KEYS,
  GEO_CDN_URL_KEYS,
  type GeokitEnv,
  type GlobeCdnFetchOptions,
} from '../../types/env.js';
import { CDN_TOKEN_SUB_KEYS } from '../../types/env.js';
import { firstEnv, readRuntimeEnv, stripTrailingSlash } from './primitives.js';

export function resolveGeoCdnBaseUrlFromEnv(
  env: GeokitEnv = readRuntimeEnv(),
  baseUrl?: string
): string {
  const fromArg = baseUrl?.trim();
  if (fromArg !== undefined) return stripTrailingSlash(fromArg);

  const fromEnv = firstEnv(env, GEO_CDN_URL_KEYS);
  if (fromEnv !== undefined) return stripTrailingSlash(fromEnv);

  return '';
}

export function isGeoCdnConfiguredFromEnv(
  env: GeokitEnv = readRuntimeEnv(),
  baseUrl?: string
): boolean {
  return resolveGeoCdnBaseUrlFromEnv(env, baseUrl).length > 0;
}

export function resolveGlobeCdnJwtFromEnv(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, GEO_CDN_JWT_KEYS);
}

export function resolveGlobeCdnJwtSecretFromEnv(
  env: GeokitEnv = readRuntimeEnv()
): string | undefined {
  return firstEnv(env, GEO_CDN_JWT_SECRET_KEYS);
}

export function resolveCdnTokenSubFromEnv(env: GeokitEnv = readRuntimeEnv()): string {
  return firstEnv(env, CDN_TOKEN_SUB_KEYS) ?? 'geokit-mcp';
}

export function formatGlobeCdnAuthHeader(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

export function globeCdnAuthHeaderFromEnv(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  const token = resolveGlobeCdnJwtFromEnv(env);
  if (!token) return undefined;
  return formatGlobeCdnAuthHeader(token);
}

export function isGlobeCdnJwtConfigured(env: GeokitEnv = readRuntimeEnv()): boolean {
  return Boolean(resolveGlobeCdnJwtFromEnv(env));
}

export function resolveGlobeCdnFetchOptions(
  env: GeokitEnv = readRuntimeEnv(),
  options?: { cdnBaseUrl?: string }
): GlobeCdnFetchOptions {
  const auth = globeCdnAuthHeaderFromEnv(env);
  if (!auth) {
    return { baseUrl: options?.cdnBaseUrl };
  }
  return {
    baseUrl: options?.cdnBaseUrl,
    init: { headers: { Accept: 'application/json', Authorization: auth } },
  };
}
