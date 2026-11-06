import type { MapUiProviderId } from './types/map-provider';
import type { GeokitEnv } from './types/env';
import {
  MAPBOX_KEY_KEYS,
  MAP_GENERIC_API_KEY_KEYS,
  MAP_PROVIDER_KEYS,
  MAP_REFERER_KEYS,
  MAPTILER_KEY_KEYS,
  PROTOMAPS_KEY_KEYS,
} from './types/env';
import { firstEnv, readRuntimeEnv } from './primitives';

export type MapProviderEnv = GeokitEnv;

const MAP_UI_PROVIDER_IDS: readonly MapUiProviderId[] = ['maptiler', 'mapbox', 'protomaps'];

function normalizeProviderHint(hint: string | undefined): MapUiProviderId | undefined {
  const trimmed = hint?.trim();
  if (trimmed === 'maptiler' || trimmed === 'mapbox' || trimmed === 'protomaps') return trimmed;
  return undefined;
}

function isMapUiProviderId(value: string): value is MapUiProviderId {
  return (MAP_UI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function resolveMaptilerKeyFromEnv(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, MAPTILER_KEY_KEYS);
}

export function resolveMapboxKeyFromEnv(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, MAPBOX_KEY_KEYS);
}

export function resolveProtomapsKeyFromEnv(env: GeokitEnv = readRuntimeEnv()): string | undefined {
  return firstEnv(env, PROTOMAPS_KEY_KEYS);
}

export function resolveMapGenericApiKeyFromEnv(
  env: GeokitEnv = readRuntimeEnv()
): string | undefined {
  return firstEnv(env, MAP_GENERIC_API_KEY_KEYS);
}

export function resolveMapProviderIdFromEnv(
  env: GeokitEnv = readRuntimeEnv(),
  options?: { providerHint?: string }
): MapUiProviderId {
  const hint = normalizeProviderHint(options?.providerHint);
  const raw = hint ?? firstEnv(env, MAP_PROVIDER_KEYS);

  if (raw) {
    if (isMapUiProviderId(raw)) return raw;
    throw new Error(`Unknown map provider "${raw}". Set GEOKIT_MAP_PROVIDER to a supported value.`);
  }

  const maptilerKey = resolveMaptilerKeyFromEnv(env);
  const mapboxKey = resolveMapboxKeyFromEnv(env);
  const protomapsKey = resolveProtomapsKeyFromEnv(env);
  const genericKey = resolveMapGenericApiKeyFromEnv(env);

  if (protomapsKey && !maptilerKey && !mapboxKey) return 'protomaps';
  if (genericKey && !maptilerKey && !mapboxKey) {
    return 'maptiler';
  }
  if (maptilerKey && !mapboxKey) return 'maptiler';
  if (mapboxKey && !maptilerKey) return 'mapbox';
  if (maptilerKey && mapboxKey) return 'maptiler';

  return 'maptiler';
}

export function resolveMapApiKeyFromEnv(
  env: GeokitEnv = readRuntimeEnv(),
  providerId: MapUiProviderId
): string {
  const generic = resolveMapGenericApiKeyFromEnv(env);

  switch (providerId) {
    case 'maptiler':
      return resolveMaptilerKeyFromEnv(env) ?? generic ?? '';
    case 'mapbox':
      return resolveMapboxKeyFromEnv(env) ?? generic ?? '';
    case 'protomaps':
      return resolveProtomapsKeyFromEnv(env) ?? generic ?? '';
    default: {
      const exhaustive: never = providerId;
      return exhaustive;
    }
  }
}

export function resolveMapRefererFromEnv(
  env: GeokitEnv = readRuntimeEnv(),
  mapHostBaseUrl?: string
): string | undefined {
  const explicit = firstEnv(env, MAP_REFERER_KEYS);
  if (explicit) return explicit;

  if (!mapHostBaseUrl) return undefined;

  try {
    return `${new URL(mapHostBaseUrl).origin}/`;
  } catch {
    return undefined;
  }
}

export function resolveDedicatedMapKeysFromEnv(env: GeokitEnv = readRuntimeEnv()): {
  maptilerKey?: string;
  mapboxKey?: string;
  protomapsKey?: string;
} {
  return {
    maptilerKey: resolveMaptilerKeyFromEnv(env),
    mapboxKey: resolveMapboxKeyFromEnv(env),
    protomapsKey: resolveProtomapsKeyFromEnv(env),
  };
}
