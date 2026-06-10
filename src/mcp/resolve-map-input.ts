import { resolvePlaceOrBoroughBounds, resolveShapeBounds } from '@twinfile/geokit/cdn';
import type { Bounds } from '@twinfile/geokit/types';
import type { MapViewInput } from '../types/mcp-map.js';

export type ResolveMapViewInputOptions = {
  cdnBaseUrl?: string;
  fetchInit?: RequestInit;
};

export async function resolveMapViewInput(
  input: MapViewInput,
  options?: ResolveMapViewInputOptions
): Promise<MapViewInput> {
  if (input.bounds?.length === 4) return input;
  if (typeof input.lat === 'number' && typeof input.lng === 'number') return input;

  const cdnOptions = { baseUrl: options?.cdnBaseUrl, init: options?.fetchInit };
  let bounds: Bounds | null = null;

  if (input.countyFips?.trim()) {
    bounds = await resolveShapeBounds({ countyFips: input.countyFips.trim() }, cdnOptions);
  } else if (input.state?.trim() && input.place?.trim()) {
    bounds = await resolvePlaceOrBoroughBounds(input.state.trim(), input.place.trim(), cdnOptions);
  }

  if (!bounds) {
    throw new Error('Map view requires lat/lng, bounds, countyFips, or state+place (CDN shape)');
  }

  return {
    ...input,
    bounds: [...bounds] as [number, number, number, number],
  };
}
