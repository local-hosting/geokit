import type { GlobeCdnFetchOptions } from '../cdn/fetch.js';

function globeCdnAuthHeader(): string | undefined {
  const token =
    process.env.GEOKIT_GLOBE_CDN_JWT?.trim() ??
    process.env.GLOBE_CDN_JWT?.trim() ??
    process.env.FW_GLOBE_CDN_JWT?.trim();
  if (!token) return undefined;
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

export function resolveGlobeCdnFetchOptions(options?: {
  cdnBaseUrl?: string;
}): GlobeCdnFetchOptions {
  const auth = globeCdnAuthHeader();
  if (!auth) {
    return { baseUrl: options?.cdnBaseUrl };
  }
  return {
    baseUrl: options?.cdnBaseUrl,
    init: { headers: { Accept: 'application/json', Authorization: auth } },
  };
}
