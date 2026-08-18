export type { GeokitEnv } from '../../types/env.js';
export {
  FOURSQUARE_KEY_KEYS,
  GOOGLE_PLACES_KEY_KEYS,
  GEOKIT_ENV_ALIAS_GROUPS,
  MAPBOX_KEY_KEYS,
  MAP_GENERIC_API_KEY_KEYS,
  MAP_HOST_URL_KEYS,
  MAP_PROVIDER_KEYS,
  MAP_REFERER_KEYS,
  MAP_STYLE_URL_KEYS,
  MAPTILER_KEY_KEYS,
  ROUTING_TOKEN_KEYS,
  TILE_API_URL_KEYS,
  TILE_CDN_URL_KEYS,
} from '../../types/env.js';

export {
  envTrim,
  firstEnv,
  readProcessEnv,
  readRuntimeEnv,
  readViteEnv,
  stripTrailingSlash,
  writeEnvKeys,
} from './primitives.js';

export { applyGeokitEnvAliases } from './aliases.js';

export {
  resolveDedicatedMapKeysFromEnv,
  resolveMapApiKeyFromEnv,
  resolveMapboxKeyFromEnv,
  resolveMapProviderIdFromEnv,
  resolveMapRefererFromEnv,
  resolveMaptilerKeyFromEnv,
  type MapProviderEnv,
} from './map-credentials.js';

export {
  DEFAULT_MAP_HOST_URL,
  resolveFoursquareApiKey,
  resolveGooglePlacesApiKey,
  resolveGeocodingApiKey,
  resolveMapHostBaseUrlFromEnv,
  resolveRoutingAccessToken,
} from './service-keys.js';

export {
  applyLoadedEnvToProcess,
  bootstrapGeokitMcpEnv,
  loadGeokitProcessEnv,
} from './bootstrap.js';
