/**
 * Unified same-origin geo vendor proxy paths (`/__geo/...`).
 * Host apps (Vite, Vercel, edge) forward these prefixes to upstream APIs.
 */

export const GEO_PROXY_ROOT = '/__geo';

export const GEO_FOURSQUARE_PROXY_PREFIX = `${GEO_PROXY_ROOT}/foursquare`;
export const GEO_MAPTILER_API_PROXY_PREFIX = `${GEO_PROXY_ROOT}/maptiler-api`;
export const GEO_MAPTILER_CDN_PROXY_PREFIX = `${GEO_PROXY_ROOT}/maptiler-cdn`;

/** Normalize to a trailing slash for prefix rewrites. */
export function geoProxyPathWithSlash(prefix: string): string {
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

export const GEO_MAPTILER_API_PROXY = geoProxyPathWithSlash(GEO_MAPTILER_API_PROXY_PREFIX);
export const GEO_MAPTILER_CDN_PROXY = geoProxyPathWithSlash(GEO_MAPTILER_CDN_PROXY_PREFIX);

const LEGACY_MAPTILER_API = '/__maptiler-api/';
const LEGACY_MAPTILER_CDN = '/__maptiler-cdn/';

/** True when `url` is already routed through a host geo proxy path. */
export function isSameOriginGeoProxyPath(url: string): boolean {
  return (
    url.startsWith(`${GEO_PROXY_ROOT}/`) ||
    url.startsWith(LEGACY_MAPTILER_API) ||
    url.startsWith(LEGACY_MAPTILER_CDN)
  );
}

/** Expand relative proxy paths to absolute URLs for worker fetches. */
export function absolutizeSameOriginGeoProxyPath(url: string): string {
  if (typeof window === 'undefined') return url;
  if (url.startsWith('/') && isSameOriginGeoProxyPath(url)) {
    return `${window.location.origin}${url}`;
  }
  return url;
}
