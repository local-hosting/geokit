/**
 * Dev proxy helpers for MapTiler — rewrite tile/style URLs to same-origin proxy paths.
 * MapLibre web workers omit Referer, which breaks referrer-restricted API keys.
 */

export type MapTilerTransformRequest = (url: string, resourceType?: string) => { url: string };

export type MapTilerDevProxyOptions = {
  enabled: boolean;
  apiPrefix?: string;
  cdnPrefix?: string;
  proxyApiPrefix?: string;
  proxyCdnPrefix?: string;
};

const DEFAULT_API_PREFIX = 'https://api.maptiler.com/';
const DEFAULT_CDN_PREFIX = 'https://cdn.maptiler.com/';

function rewriteWithPrefixes(url: string, fromPrefix: string, toPrefix: string): string | null {
  if (url.startsWith(fromPrefix)) {
    return `${toPrefix}${url.slice(fromPrefix.length)}`;
  }
  return null;
}

/** Rewrite MapTiler HTTPS URLs to same-origin dev proxy paths. */
export function rewriteMapTilerUrl(url: string, options: MapTilerDevProxyOptions): string {
  if (!options.enabled || typeof url !== 'string') return url;

  const apiPrefix = options.apiPrefix ?? DEFAULT_API_PREFIX;
  const cdnPrefix = options.cdnPrefix ?? DEFAULT_CDN_PREFIX;
  const proxyApiPrefix = options.proxyApiPrefix ?? '/__maptiler-api/';
  const proxyCdnPrefix = options.proxyCdnPrefix ?? '/__maptiler-cdn/';

  return (
    rewriteWithPrefixes(url, apiPrefix, proxyApiPrefix) ??
    rewriteWithPrefixes(url, cdnPrefix, proxyCdnPrefix) ??
    rewriteWithPrefixes(url, apiPrefix.replace('https://', 'http://'), proxyApiPrefix) ??
    rewriteWithPrefixes(url, cdnPrefix.replace('https://', 'http://'), proxyCdnPrefix) ??
    url
  );
}

export function createMapTilerDevTransformRequest(
  options: MapTilerDevProxyOptions
): MapTilerTransformRequest {
  return (url) => ({ url: rewriteMapTilerUrl(url, options) });
}

export function mapTilerProviderConfig(
  apiKey: string,
  options: MapTilerDevProxyOptions
): {
  apiKey: string;
  transformRequest?: MapTilerTransformRequest;
} {
  if (!options.enabled) {
    return { apiKey };
  }
  return { apiKey, transformRequest: createMapTilerDevTransformRequest(options) };
}
