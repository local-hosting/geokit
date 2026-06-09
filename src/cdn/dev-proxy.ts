/**
 * Globe CDN URL rewrite for apps that opt into a same-origin dev proxy (e.g. Fieldwise).
 * Geokit demos and gk-layer fetch mapto.link directly.
 */

export const GLOBE_CDN_DEV_PROXY_PREFIX = '/__globe-cdn';

export type GlobeCdnDevProxyOptions = {
  enabled: boolean;
  cdnBaseUrl: string;
  proxyPrefix?: string;
};

function cdnOrigin(cdnBaseUrl: string): string {
  return new URL(cdnBaseUrl).origin;
}

/** Rewrite absolute Globe CDN URLs to a same-origin dev proxy prefix. */
export function rewriteGlobeCdnUrlForDevProxy(
  url: string,
  options: GlobeCdnDevProxyOptions
): string {
  if (!options.enabled || typeof url !== 'string') return url;

  const prefix = options.proxyPrefix ?? GLOBE_CDN_DEV_PROXY_PREFIX;

  try {
    const parsed = new URL(url, options.cdnBaseUrl);
    if (parsed.origin !== cdnOrigin(options.cdnBaseUrl)) return url;
    return `${prefix}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
