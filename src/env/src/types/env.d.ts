/** Trimmed string map — process.env, Vite import.meta.env, or injected test env. */
export type GeokitEnv = Record<string, string | undefined>;
export declare const MAP_PROVIDER_KEYS: readonly ["GEOKIT_MAP_PROVIDER", "MAP_PROVIDER"];
export declare const MAP_GENERIC_API_KEY_KEYS: readonly ["GEOKIT_MAP_API_KEY", "MAP_API_KEY"];
export declare const MAPTILER_KEY_KEYS: readonly ["MAPTILER_KEY", "GEOKIT_MAPTILER_KEY"];
export declare const MAPBOX_KEY_KEYS: readonly ["MAPBOX_TOKEN", "MAPBOX_ACCESS_TOKEN", "GEOKIT_MAPBOX_KEY"];
export declare const ROUTING_TOKEN_KEYS: readonly ["GEOKIT_ROUTING_TOKEN", "ROUTING_TOKEN"];
export declare const MAP_REFERER_KEYS: readonly ["GEOKIT_MAP_REFERER", "MAP_REFERER", "MAPTILER_REFERER", "GEOKIT_MAPTILER_REFERER"];
export declare const MAP_HOST_URL_KEYS: readonly ["GEOKIT_MAP_HOST_URL", "MAP_HOST_URL"];
export declare const MAP_STYLE_URL_KEYS: readonly ["GEOKIT_MAP_STYLE_URL", "MAP_STYLE_URL"];
export declare const TILE_API_URL_KEYS: readonly ["GEOKIT_TILE_API_URL", "TILE_API_URL"];
export declare const TILE_CDN_URL_KEYS: readonly ["GEOKIT_TILE_CDN_URL", "TILE_CDN_URL"];
export declare const GOOGLE_PLACES_KEY_KEYS: readonly ["GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY", "GEOKIT_GOOGLE_PLACES_KEY"];
export declare const HERE_KEY_KEYS: readonly ["HERE_API_KEY", "GEOKIT_HERE_API_KEY"];
export declare const ESRI_KEY_KEYS: readonly ["ESRI_API_KEY", "ARCGIS_API_KEY", "GEOKIT_ESRI_API_KEY"];
export declare const FOURSQUARE_KEY_KEYS: readonly ["FOURSQUARE_SERVICE_API_KEY", "FOURSQUARE_API_KEY", "FSQ_API_KEY", "GEOKIT_FOURSQUARE_KEY"];
export type EnvAliasGroup = {
    sources: readonly string[];
    targets: readonly string[];
};
/** Mirror keys across legacy names so one configured value satisfies all readers. */
export declare const GEOKIT_ENV_ALIAS_GROUPS: EnvAliasGroup[];
//# sourceMappingURL=env.d.ts.map