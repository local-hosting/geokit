import { resolvePlaceOrBoroughBounds, resolveShapeBounds } from '@twinfile/geokit/cdn';
import type { Bounds } from '@twinfile/geokit/types';
import type { MapViewInput } from '../types/mcp-map.js';
import { resolveShowMapContext } from './business/resolve-place.js';
import { ensureGlobeCdnJwt } from './resolve-globe-cdn-auth.js';

export type ResolveMapViewInputOptions = {
  cdnBaseUrl?: string;
  fetchInit?: RequestInit;
};

function hasPointInput(input: MapViewInput): boolean {
  return typeof input.lat === 'number' && typeof input.lng === 'number';
}

function hasBoundsInput(input: MapViewInput): boolean {
  return input.bounds?.length === 4;
}

function geocodeQueryFromInput(input: MapViewInput): string | null {
  const query = input.query?.trim();
  if (query) return query;

  const place = input.place?.trim();
  const state = input.state?.trim();
  if (place && !state) return place;

  return null;
}

export async function resolveMapViewInput(
  input: MapViewInput,
  options?: ResolveMapViewInputOptions
): Promise<MapViewInput> {
  if (hasBoundsInput(input)) return input;
  if (hasPointInput(input)) return input;

  const cdnOptions = { baseUrl: options?.cdnBaseUrl, init: options?.fetchInit };
  let bounds: Bounds | null = null;

  if (input.countyFips?.trim()) {
    bounds = await resolveShapeBounds({ countyFips: input.countyFips.trim() }, cdnOptions);
  } else if (input.state?.trim() && input.place?.trim()) {
    bounds = await resolvePlaceOrBoroughBounds(input.state.trim(), input.place.trim(), cdnOptions);
  }

  if (bounds) {
    return {
      ...input,
      bounds: [...bounds] as [number, number, number, number],
    };
  }

  const geocodeQuery = geocodeQueryFromInput(input);
  if (geocodeQuery) {
    await ensureGlobeCdnJwt();
    const context = await resolveShowMapContext(geocodeQuery, { cdnBaseUrl: options?.cdnBaseUrl });
    const resolved = context.place;

    return {
      ...input,
      lat: resolved.lat,
      lng: resolved.lng,
      label: input.label ?? resolved.label,
      bounds: resolved.bounds
        ? ([...resolved.bounds] as [number, number, number, number])
        : undefined,
      regionGeometry: context.regionGeometry,
      regionLayer: context.regionLayer,
    };
  }

  throw new Error(
    'Map view requires lat/lng, bounds, countyFips, state+place (CDN shape), or a place/query to geocode'
  );
}
