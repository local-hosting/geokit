/**
 * Dev proxy helpers for MapTiler — rewrite tile/style URLs to same-origin proxy paths.
 * MapLibre web workers omit Referer, which breaks referrer-restricted API keys.
 */

import {
  GEO_MAPTILER_API_PROXY,
  GEO_MAPTILER_CDN_PROXY,
  absolutizeSameOriginGeoProxyPath,
} from '../config/geo-proxy';

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

function absolutizeSameOriginProxyPath(url: string): string {
  return absolutizeSameOriginGeoProxyPath(url);
}

/** Rewrite MapTiler HTTPS URLs to same-origin dev proxy paths. */
export function rewriteMapTilerUrl(url: string, options: MapTilerDevProxyOptions): string {
  if (!options.enabled || typeof url !== 'string') return url;

  const apiPrefix = options.apiPrefix ?? DEFAULT_API_PREFIX;
  const cdnPrefix = options.cdnPrefix ?? DEFAULT_CDN_PREFIX;
  const proxyApiPrefix = options.proxyApiPrefix ?? GEO_MAPTILER_API_PROXY;
  const proxyCdnPrefix = options.proxyCdnPrefix ?? GEO_MAPTILER_CDN_PROXY;

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

/** Rewrite embedded style.json resource URLs (sources, sprite, glyphs) for dev proxy. */
export function rewriteMapTilerStyleResourceUrls(
  style: Record<string, unknown>,
  transformRequest: MapTilerTransformRequest
): void {
  const sources = style.sources;
  if (sources && typeof sources === 'object') {
    for (const source of Object.values(sources as Record<string, unknown>)) {
      if (!source || typeof source !== 'object') continue;
      const src = source as Record<string, unknown>;
      if (typeof src.url === 'string') {
        src.url = transformRequest(src.url, 'Source').url;
      }
      if (Array.isArray(src.tiles)) {
        src.tiles = src.tiles.map((tile) =>
          typeof tile === 'string' ? transformRequest(tile, 'Tile').url : tile
        );
      }
    }
  }
  if (typeof style.sprite === 'string') {
    style.sprite = transformRequest(style.sprite, 'SpriteJSON').url;
  }
  if (typeof style.glyphs === 'string') {
    style.glyphs = transformRequest(style.glyphs, 'Glyphs').url;
  }
}

function isMapTilerTileJsonSource(src: Record<string, unknown>): boolean {
  if (src.tiles || typeof src.url !== 'string') return false;
  if (src.type !== 'vector' && src.type !== 'raster' && src.type !== 'raster-dem') {
    return false;
  }
  return src.url.includes('tiles.json') || src.url.includes('/tiles/');
}

/**
 * Expand TileJSON `url` sources into inline `tiles` templates with proxied paths.
 * MapLibre workers fetch tile PBFs without Referer — direct api.maptiler.com URLs 403
 * when the key is referrer-locked; transformRequest does not run in workers.
 */
export async function inlineMapTilerTileJsonSources(
  style: Record<string, unknown>,
  transformRequest: MapTilerTransformRequest
): Promise<void> {
  const sources = style.sources;
  if (!sources || typeof sources !== 'object') return;

  await Promise.all(
    Object.values(sources as Record<string, unknown>).map(async (source) => {
      if (!source || typeof source !== 'object') return;
      const src = source as Record<string, unknown>;
      if (!isMapTilerTileJsonSource(src)) return;

      const tileJsonUrl = src.url as string;
      try {
        const resp = await fetch(tileJsonUrl);
        if (!resp.ok) return;
        const tileJson = (await resp.json()) as {
          tiles?: unknown[];
          minzoom?: unknown;
          maxzoom?: unknown;
          bounds?: unknown;
        };
        if (!Array.isArray(tileJson.tiles) || tileJson.tiles.length === 0) return;

        src.tiles = tileJson.tiles.map((tile) =>
          typeof tile === 'string'
            ? absolutizeSameOriginProxyPath(transformRequest(tile, 'Tile').url)
            : tile
        );
        // Preserve TileJSON zoom/bounds so MapLibre overzooms instead of fetching
        // unavailable high-z tiles (MapTiler returns 400 "Out of bounds").
        if (typeof tileJson.minzoom === 'number') src.minzoom = tileJson.minzoom;
        if (typeof tileJson.maxzoom === 'number') src.maxzoom = tileJson.maxzoom;
        if (Array.isArray(tileJson.bounds)) src.bounds = tileJson.bounds;
        delete src.url;
      } catch {
        /* keep url fallback when TileJSON fetch fails */
      }
    })
  );
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
