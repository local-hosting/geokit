/** Trimmed string map — process.env, Vite import.meta.env, or injected test env. */
export type GeokitEnv = Record<string, string | undefined>;

export const MAP_PROVIDER_KEYS = ['GEOKIT_MAP_PROVIDER', 'MAP_PROVIDER'] as const;

export const MAP_GENERIC_API_KEY_KEYS = ['GEOKIT_MAP_API_KEY', 'MAP_API_KEY'] as const;

export const MAPTILER_KEY_KEYS = ['MAPTILER_KEY', 'GEOKIT_MAPTILER_KEY'] as const;

export const MAPBOX_KEY_KEYS = [
  'MAPBOX_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'GEOKIT_MAPBOX_KEY',
] as const;

export const ROUTING_TOKEN_KEYS = ['GEOKIT_ROUTING_TOKEN', 'ROUTING_TOKEN'] as const;

export const MAP_REFERER_KEYS = [
  'GEOKIT_MAP_REFERER',
  'MAP_REFERER',
  'MAPTILER_REFERER',
  'GEOKIT_MAPTILER_REFERER',
] as const;

export const MAP_HOST_URL_KEYS = ['GEOKIT_MAP_HOST_URL', 'MAP_HOST_URL'] as const;

export const MAP_STYLE_URL_KEYS = ['GEOKIT_MAP_STYLE_URL', 'MAP_STYLE_URL'] as const;

export const TILE_API_URL_KEYS = ['GEOKIT_TILE_API_URL', 'TILE_API_URL'] as const;

export const TILE_CDN_URL_KEYS = ['GEOKIT_TILE_CDN_URL', 'TILE_CDN_URL'] as const;

export const GOOGLE_PLACES_KEY_KEYS = [
  'GOOGLE_PLACES_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'GEOKIT_GOOGLE_PLACES_KEY',
] as const;

export const HERE_KEY_KEYS = [
  'HERE_API_KEY',
  'GEOKIT_HERE_API_KEY',
] as const;

export const ESRI_KEY_KEYS = [
  'ESRI_API_KEY',
  'ARCGIS_API_KEY',
  'GEOKIT_ESRI_API_KEY',
] as const;

export const FOURSQUARE_KEY_KEYS = [
  'FOURSQUARE_SERVICE_API_KEY',
  'FOURSQUARE_API_KEY',
  'FSQ_API_KEY',
  'GEOKIT_FOURSQUARE_KEY',
] as const;


export type EnvAliasGroup = {
  sources: readonly string[];
  targets: readonly string[];
};

/** Mirror keys across legacy names so one configured value satisfies all readers. */
export const GEOKIT_ENV_ALIAS_GROUPS: EnvAliasGroup[] = [
  {
    sources: [...MAP_GENERIC_API_KEY_KEYS, ...MAPTILER_KEY_KEYS],
    targets: ['MAPTILER_KEY', 'GEOKIT_MAP_API_KEY', 'GEOKIT_MAPTILER_KEY'],
  },
  {
    sources: [...MAPBOX_KEY_KEYS, ...ROUTING_TOKEN_KEYS],
    targets: ['MAPBOX_TOKEN', 'GEOKIT_ROUTING_TOKEN', 'ROUTING_TOKEN'],
  },
  {
    sources: [...FOURSQUARE_KEY_KEYS],
    targets: ['FOURSQUARE_SERVICE_API_KEY', 'FOURSQUARE_API_KEY', 'FSQ_API_KEY'],
  },
];
