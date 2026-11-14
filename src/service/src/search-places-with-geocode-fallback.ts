import {
  ensureGeocodingRouterReady,
  ensurePlaceSearchRouterReady,
} from './builtins';
import { getServiceForCapability } from './services/registry';
import type { PlaceSearchResult } from './services/types';
import type { CapabilityRouterEnvOverrides } from './types/api-composite';
import { geocodeFeaturesToPlaceSearchResults } from './geocode-to-place-search';

export type SearchPlacesWithGeocodeFallbackOptions = {
  query: string;
  /** Map center `[lng, lat]` when available. */
  ll?: [number, number];
  limit?: number;
  /** Passed to `ensurePlaceSearchRouterReady`. */
  placeSearch?: CapabilityRouterEnvOverrides;
  /** When set, empty venue results fall back to MapTiler geocoding. */
  maptilerApiKey?: string;
};

/**
 * Venue `placeSearch`, then geocode fallback for city/region/address queries.
 */
export async function searchPlacesWithGeocodeFallback(
  options: SearchPlacesWithGeocodeFallbackOptions,
): Promise<PlaceSearchResult[]> {
  const query = options.query.trim();
  if (!query) {
    return [];
  }

  await ensurePlaceSearchRouterReady(options.placeSearch);
  const provider = getServiceForCapability('placeSearch');
  if (!provider?.placeSearch) {
    throw new Error(
      'Place search is not configured. Set FOURSQUARE_SERVICE_API_KEY or GOOGLE_PLACES_API_KEY.',
    );
  }

  const limit = options.limit ?? 8;
  const venueResults = await provider.placeSearch({
    query,
    ll: options.ll,
    limit,
    sort: 'RELEVANCE',
  });
  if (venueResults.length > 0) {
    return venueResults;
  }

  const maptilerApiKey = options.maptilerApiKey?.trim();
  if (!maptilerApiKey) {
    return [];
  }

  await ensureGeocodingRouterReady({ maptilerApiKey });
  const geocoder = getServiceForCapability('geocoding');
  if (!geocoder?.geocode) {
    return [];
  }

  const geocoded = await geocoder.geocode({
    query,
    limit,
    proximity: options.ll,
  });
  return geocodeFeaturesToPlaceSearchResults(geocoded, limit);
}
