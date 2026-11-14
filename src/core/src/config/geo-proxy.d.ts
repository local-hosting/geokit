/**
 * Unified same-origin geo vendor proxy paths (`/__geo/...`).
 * Host apps (Vite, Vercel, edge) forward these prefixes to upstream APIs.
 */
export declare const GEO_PROXY_ROOT = "/__geo";
export declare const GEO_FOURSQUARE_PROXY_PREFIX = "/__geo/foursquare";
export declare const GEO_MAPTILER_API_PROXY_PREFIX = "/__geo/maptiler-api";
export declare const GEO_MAPTILER_CDN_PROXY_PREFIX = "/__geo/maptiler-cdn";
/** Normalize to a trailing slash for prefix rewrites. */
export declare function geoProxyPathWithSlash(prefix: string): string;
export declare const GEO_MAPTILER_API_PROXY: string;
export declare const GEO_MAPTILER_CDN_PROXY: string;
/** True when `url` is already routed through a host geo proxy path. */
export declare function isSameOriginGeoProxyPath(url: string): boolean;
/** Expand relative proxy paths to absolute URLs for worker fetches. */
export declare function absolutizeSameOriginGeoProxyPath(url: string): string;
