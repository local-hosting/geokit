import type { UIProviderConfig } from '../../../providers/types';

export type SlotEnsureInput = {
  existingProvider: string | null;
  collectionProvider?: string | null;
  collectionApiKey: string | null;
  collectionAccessToken?: string | null;
  mapStyle: string | null;
  minZoom: number | null;
  maxZoom: number | null;
  mapboxConfig?: UIProviderConfig;
  maptilerConfig?: UIProviderConfig;
};

export type SlotEnsureOptions = {
  provider?: string;
  apiKey?: string | null;
  accessToken?: string | null;
  mapStyle?: string | null;
  minZoom?: number | null;
  maxZoom?: number | null;
};

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

/** Provider + credentials for pool-managed gk-map children (fills only missing attrs). */
export function resolveSlotEnsureOptions(input: SlotEnsureInput): SlotEnsureOptions {
  const collectionToken = trimmed(input.collectionAccessToken ?? undefined);
  const mapboxToken = collectionToken ?? trimmed(input.mapboxConfig?.accessToken);
  const maptilerKey =
    trimmed(input.collectionApiKey ?? undefined) ?? trimmed(input.maptilerConfig?.apiKey);

  let provider = input.existingProvider?.trim() || trimmed(input.collectionProvider ?? undefined);
  if (!provider) {
    if (mapboxToken) provider = 'mapbox';
    else if (maptilerKey) provider = 'maptiler';
  }

  const options: SlotEnsureOptions = {
    ...(provider ? { provider } : {}),
    ...(input.mapStyle ? { mapStyle: input.mapStyle } : {}),
    ...(input.minZoom !== null && input.minZoom !== undefined ? { minZoom: input.minZoom } : {}),
    ...(input.maxZoom !== null && input.maxZoom !== undefined ? { maxZoom: input.maxZoom } : {}),
  };

  if (provider === 'mapbox') {
    if (mapboxToken) options.accessToken = mapboxToken;
    return options;
  }

  if (provider === 'maptiler' && maptilerKey) {
    options.apiKey = maptilerKey;
  }

  return options;
}

export type SlotCredentialInput = {
  slotProvider: string | null;
  slotAccessToken: string | null;
  slotApiKey: string | null;
  collectionProvider: string | null;
  collectionAccessToken: string | null;
  collectionApiKey: string | null;
  mapboxConfig?: UIProviderConfig;
  maptilerConfig?: UIProviderConfig;
};

/** True when the slot or collection/registry can supply basemap credentials for activate. */
export function slotHasBasemapCredentials(input: SlotCredentialInput): boolean {
  const ensured = resolveSlotEnsureOptions({
    existingProvider: input.slotProvider,
    collectionProvider: input.collectionProvider,
    collectionApiKey: input.collectionApiKey,
    collectionAccessToken: input.collectionAccessToken,
    mapStyle: null,
    minZoom: null,
    maxZoom: null,
    mapboxConfig: input.mapboxConfig,
    maptilerConfig: input.maptilerConfig,
  });

  const provider = (input.slotProvider ?? ensured.provider)?.trim();
  if (provider === 'mapbox') {
    return Boolean(
      trimmed(input.slotAccessToken ?? undefined) ??
        ensured.accessToken ??
        trimmed(input.collectionAccessToken ?? undefined),
    );
  }
  if (provider === 'maptiler') {
    return Boolean(
      trimmed(input.slotApiKey ?? undefined) ??
        ensured.apiKey ??
        trimmed(input.collectionApiKey ?? undefined),
    );
  }
  return Boolean(
    trimmed(input.slotAccessToken ?? undefined) ??
      ensured.accessToken ??
      trimmed(input.slotApiKey ?? undefined) ??
      ensured.apiKey,
  );
}