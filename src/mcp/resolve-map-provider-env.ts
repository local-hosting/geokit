import {
  buildMaptilerStyleUrl,
  createTileCdnTransformFromEnv,
  resolveMapStyleUrlFromEnv,
} from '../config/tile-cdn.js';
import {
  resolveDedicatedMapKeysFromEnv,
  resolveMapApiKeyFromEnv,
  resolveMapProviderIdFromEnv,
  type MapProviderEnv,
} from '../config/env/index.js';
import type { MapStaticProviderId } from '../types/map-static-provider.js';
import { defaultMcpMapStyle } from './map-presentation.js';

export type { MapProviderEnv } from '../config/env/index.js';

export {
  resolveMapApiKeyFromEnv,
  resolveMapProviderIdFromEnv,
  resolveMapRefererFromEnv,
} from '../config/env/index.js';

export function resolveInteractiveMapCredentials(
  env: MapProviderEnv,
  options?: { providerHint?: string }
): {
  providerId: MapStaticProviderId;
  apiKey: string;
  maptilerApiKey?: string;
  mapboxAccessToken?: string;
  styleUrl?: string;
  tileTransform?: ReturnType<typeof createTileCdnTransformFromEnv>;
} {
  const providerId = resolveMapProviderIdFromEnv(env, options);
  const apiKey = resolveMapApiKeyFromEnv(env, providerId);
  const { maptilerKey, mapboxKey } = resolveDedicatedMapKeysFromEnv(env);

  return {
    providerId,
    apiKey,
    maptilerApiKey: maptilerKey ?? (providerId === 'maptiler' ? apiKey : undefined),
    mapboxAccessToken: mapboxKey ?? (providerId === 'mapbox' ? apiKey : undefined),
    styleUrl: resolveInteractiveMapStyle(env, providerId, options),
    tileTransform: createTileCdnTransformFromEnv(env),
  };
}

export function resolveInteractiveMapStyle(
  env: MapProviderEnv,
  providerId: MapStaticProviderId,
  options?: { providerHint?: string }
): string {
  const explicit = resolveMapStyleUrlFromEnv(env);
  if (explicit) return explicit;

  const resolvedProviderId = resolveMapProviderIdFromEnv(env, options);
  if (resolvedProviderId === 'maptiler') {
    const apiKey = resolveMapApiKeyFromEnv(env, providerId);
    if (apiKey) {
      return buildMaptilerStyleUrl(defaultMcpMapStyle('maptiler'), apiKey, env);
    }
  }

  return defaultMcpMapStyle(providerId);
}

export function defaultInteractiveMapStyle(
  providerId: MapStaticProviderId,
  env: MapProviderEnv = process.env
): string {
  return resolveInteractiveMapStyle(env, providerId);
}
