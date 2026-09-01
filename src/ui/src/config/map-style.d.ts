/**
 * Mapbox basemap style resolution — env-driven with stock Mapbox fallback.
 */
export declare const DEFAULT_MAPBOX_STYLE_URI = "mapbox://styles/mapbox/streets-v12";
/** Mapbox Static Images API style path (`owner/styleId`). */
export declare const DEFAULT_MAPBOX_STATIC_STYLE = "mapbox/streets-v12";
/** Convert `mapbox://styles/owner/id` to Static API `owner/id`. */
export declare function mapboxStyleUriToStaticStyle(styleUri: string): string;
export declare function resolveMapboxStyleUri(env?: {
    GEOKIT_MAP_STYLE_URL?: string;
    MAP_STYLE_URL?: string;
}): string;
export declare function resolveMapboxStaticStyle(env?: {
    GEOKIT_MAP_STYLE_URL?: string;
    MAP_STYLE_URL?: string;
}): string;
//# sourceMappingURL=map-style.d.ts.map