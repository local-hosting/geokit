import type {
  MapStaticProviderId,
  MapStaticSnapshotAdapter,
  ResolvedMapStaticProvider,
} from '../types/map-static-provider.js';
import { mapboxStaticAdapter } from './providers/mapbox-static.js';
import { maptilerStaticAdapter } from './providers/maptiler-static.js';
import { resolveMapHostBaseUrl } from './open-map.js';
import {
  resolveMapApiKeyFromEnv,
  resolveMapProviderIdFromEnv,
  resolveMapRefererFromEnv,
  type MapProviderEnv,
} from './resolve-map-provider-env.js';

const PROVIDER_ADAPTERS: Record<MapStaticProviderId, MapStaticSnapshotAdapter> = {
  maptiler: maptilerStaticAdapter,
  mapbox: mapboxStaticAdapter,
};

function processEnv(): MapProviderEnv {
  return { ...process.env };
}

export function resolveMapStaticProviderFromEnv(
  env: MapProviderEnv = processEnv()
): ResolvedMapStaticProvider {
  const id = resolveMapProviderIdFromEnv(env);
  const apiKey = resolveMapApiKeyFromEnv(env, id);
  const adapter = PROVIDER_ADAPTERS[id];

  return {
    id,
    apiKey,
    referer: resolveMapRefererFromEnv(env, resolveMapHostBaseUrl()),
    adapter,
  };
}

export function resolveMapStaticProvider(): ResolvedMapStaticProvider {
  return resolveMapStaticProviderFromEnv(processEnv());
}

export function assertMapStaticProviderConfigured(
  provider: ResolvedMapStaticProvider
): ResolvedMapStaticProvider {
  if (!provider.apiKey) {
    throw new Error(
      'Map API key is not configured. Set GEOKIT_MAP_API_KEY (or MAP_API_KEY) and optionally GEOKIT_MAP_PROVIDER.'
    );
  }
  return provider;
}
