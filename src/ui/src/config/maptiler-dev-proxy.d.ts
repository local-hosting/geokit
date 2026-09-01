/**
 * Dev proxy helpers for MapTiler — rewrite tile/style URLs to same-origin proxy paths.
 * MapLibre web workers omit Referer, which breaks referrer-restricted API keys.
 */
export type MapTilerTransformRequest = (url: string, resourceType?: string) => {
    url: string;
};
export type MapTilerDevProxyOptions = {
    enabled: boolean;
    apiPrefix?: string;
    cdnPrefix?: string;
    proxyApiPrefix?: string;
    proxyCdnPrefix?: string;
};
/** Rewrite MapTiler HTTPS URLs to same-origin dev proxy paths. */
export declare function rewriteMapTilerUrl(url: string, options: MapTilerDevProxyOptions): string;
export declare function createMapTilerDevTransformRequest(options: MapTilerDevProxyOptions): MapTilerTransformRequest;
/** Rewrite embedded style.json resource URLs (sources, sprite, glyphs) for dev proxy. */
export declare function rewriteMapTilerStyleResourceUrls(style: Record<string, unknown>, transformRequest: MapTilerTransformRequest): void;
/**
 * Expand TileJSON `url` sources into inline `tiles` templates with proxied paths.
 * MapLibre workers fetch tile PBFs without Referer — direct api.maptiler.com URLs 403
 * when the key is referrer-locked; transformRequest does not run in workers.
 */
export declare function inlineMapTilerTileJsonSources(style: Record<string, unknown>, transformRequest: MapTilerTransformRequest): Promise<void>;
export declare function mapTilerProviderConfig(apiKey: string, options: MapTilerDevProxyOptions): {
    apiKey: string;
    transformRequest?: MapTilerTransformRequest;
};
//# sourceMappingURL=maptiler-dev-proxy.d.ts.map