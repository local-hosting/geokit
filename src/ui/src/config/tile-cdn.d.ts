/**
 * Basemap tile/style CDN — point MapLibre style and tile URLs at your own host.
 */
import { type MapTilerTransformRequest } from './maptiler-dev-proxy';
import type { GeokitEnv } from '@twinfile/geokit/env';
export type TileCdnEnv = GeokitEnv;
/** Full MapLibre style.json URL (overrides built-in MapTiler style names). */
export declare function resolveMapStyleUrlFromEnv(env?: TileCdnEnv): string | undefined;
/** Replace `https://api.maptiler.com/` (style + static API + TileJSON). */
export declare function resolveTileApiUrlFromEnv(env?: TileCdnEnv): string | undefined;
/** Replace `https://cdn.maptiler.com/` (raster/vector tile bytes). */
export declare function resolveTileCdnUrlFromEnv(env?: TileCdnEnv): string | undefined;
export declare function normalizeUrlPrefix(url: string | undefined, fallback: string): string;
export declare function resolveMaptilerApiPrefix(env?: TileCdnEnv): string;
export declare function resolveMaptilerCdnPrefix(env?: TileCdnEnv): string;
/** Base for MapTiler static snapshot API: `{api}/maps`. */
export declare function resolveMaptilerStaticMapsBase(env?: TileCdnEnv): string;
export declare function buildMaptilerStyleUrl(styleName: string, apiKey: string, env?: TileCdnEnv): string;
/** Rewrite embedded MapTiler tile/style URLs when custom tile CDN prefixes are set. */
export declare function createTileCdnTransformFromEnv(env?: TileCdnEnv): MapTilerTransformRequest | undefined;
export declare function tileCdnConfigured(env?: TileCdnEnv): boolean;
//# sourceMappingURL=tile-cdn.d.ts.map