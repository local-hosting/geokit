import type { MapStaticProviderId } from '../types/map-static-provider.js';

export type MapProviderEnv = Record<string, string | undefined>;

function envTrim(env: MapProviderEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

function normalizeProviderHint(hint: string | undefined): MapStaticProviderId | undefined {
  const trimmed = hint?.trim();
  if (trimmed === 'maptiler' || trimmed === 'mapbox') return trimmed;
  return undefined;
}

export function resolveMapProviderIdFromEnv(
  env: MapProviderEnv,
  options?: { providerHint?: string }
): MapStaticProviderId {
  const hint = normalizeProviderHint(options?.providerHint);
  const raw = hint ?? envTrim(env, 'GEOKIT_MAP_PROVIDER') ?? envTrim(env, 'MAP_PROVIDER');

  if (raw) {
    if (raw === 'maptiler' || raw === 'mapbox') return raw;
    throw new Error(`Unknown map provider "${raw}". Set GEOKIT_MAP_PROVIDER to a supported value.`);
  }

  const maptilerKey = envTrim(env, 'MAPTILER_KEY') ?? envTrim(env, 'GEOKIT_MAPTILER_KEY');
  const mapboxKey =
    envTrim(env, 'MAPBOX_TOKEN') ??
    envTrim(env, 'MAPBOX_ACCESS_TOKEN') ??
    envTrim(env, 'GEOKIT_MAPBOX_KEY');
  const genericKey = envTrim(env, 'GEOKIT_MAP_API_KEY') ?? envTrim(env, 'MAP_API_KEY');

  if (genericKey && !maptilerKey && !mapboxKey) {
    return 'maptiler';
  }
  if (maptilerKey && !mapboxKey) return 'maptiler';
  if (mapboxKey && !maptilerKey) return 'mapbox';
  if (maptilerKey && mapboxKey) return 'maptiler';

  return 'maptiler';
}

export function resolveMapApiKeyFromEnv(
  env: MapProviderEnv,
  providerId: MapStaticProviderId
): string {
  const generic = envTrim(env, 'GEOKIT_MAP_API_KEY') ?? envTrim(env, 'MAP_API_KEY');
  if (generic) return generic;

  if (providerId === 'maptiler') {
    return envTrim(env, 'MAPTILER_KEY') ?? envTrim(env, 'GEOKIT_MAPTILER_KEY') ?? '';
  }

  return (
    envTrim(env, 'MAPBOX_TOKEN') ??
    envTrim(env, 'MAPBOX_ACCESS_TOKEN') ??
    envTrim(env, 'GEOKIT_MAPBOX_KEY') ??
    ''
  );
}

export function resolveMapRefererFromEnv(
  env: MapProviderEnv,
  mapHostBaseUrl?: string
): string | undefined {
  const explicit = envTrim(env, 'GEOKIT_MAP_REFERER') ?? envTrim(env, 'MAP_REFERER');
  if (explicit) return explicit;

  const legacyReferer = envTrim(env, 'MAPTILER_REFERER') ?? envTrim(env, 'GEOKIT_MAPTILER_REFERER');
  if (legacyReferer) return legacyReferer;

  if (!mapHostBaseUrl) return undefined;

  try {
    return `${new URL(mapHostBaseUrl).origin}/`;
  } catch {
    return undefined;
  }
}

export function resolveInteractiveMapCredentials(
  env: MapProviderEnv,
  options?: { providerHint?: string }
): {
  providerId: MapStaticProviderId;
  apiKey: string;
  maptilerApiKey?: string;
  mapboxAccessToken?: string;
} {
  const providerId = resolveMapProviderIdFromEnv(env, options);
  const apiKey = resolveMapApiKeyFromEnv(env, providerId);
  const dedicatedMaptilerKey = envTrim(env, 'MAPTILER_KEY') ?? envTrim(env, 'GEOKIT_MAPTILER_KEY');
  const dedicatedMapboxToken =
    envTrim(env, 'MAPBOX_TOKEN') ??
    envTrim(env, 'MAPBOX_ACCESS_TOKEN') ??
    envTrim(env, 'GEOKIT_MAPBOX_KEY');

  return {
    providerId,
    apiKey,
    maptilerApiKey: dedicatedMaptilerKey ?? (providerId === 'maptiler' ? apiKey : undefined),
    mapboxAccessToken: dedicatedMapboxToken ?? (providerId === 'mapbox' ? apiKey : undefined),
  };
}

export function defaultInteractiveMapStyle(providerId: MapStaticProviderId): string {
  return providerId === 'mapbox' ? 'dark-v11' : 'basic';
}
