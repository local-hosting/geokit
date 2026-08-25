import {
  FOURSQUARE_PLACES_API_BASE,
  FOURSQUARE_PLACES_API_VERSION,
  type FoursquarePlaceLocation,
  type FoursquarePlaceRaw,
  type FoursquarePlacesSearchParams,
  type FoursquarePlacesSearchResponse,
  type NormalizedFoursquarePlace,
} from './types/foursquare-places.js';

import { resolveFoursquareApiKey } from '@geokit/env';

export function foursquarePlacesApiKey(): string | undefined {
  return resolveFoursquareApiKey();
}

/** @deprecated use foursquarePlacesApiKey */
export const foursquareApiKey = foursquarePlacesApiKey;

export function foursquarePlacesAuthHeader(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (/^Bearer\s+/i.test(trimmed)) return trimmed;
  return `Bearer ${trimmed}`;
}

export function foursquarePlacesHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: foursquarePlacesAuthHeader(apiKey),
    Accept: 'application/json',
    'X-Places-Api-Version': FOURSQUARE_PLACES_API_VERSION,
  };
}

export function buildFoursquarePlacesSearchUrl(params: FoursquarePlacesSearchParams): URL {
  const url = new URL(`${FOURSQUARE_PLACES_API_BASE}/places/search`);

  if (params.query) {
    url.searchParams.set('query', params.query);
  }

  if (params.ll) {
    url.searchParams.set('ll', `${params.ll[1]},${params.ll[0]}`);
  }

  if (params.radius !== undefined) {
    url.searchParams.set('radius', String(Math.round(params.radius)));
  }

  if (params.categories && params.categories.length > 0) {
    url.searchParams.set('categories', params.categories.join(','));
  }

  if (params.limit !== undefined) {
    url.searchParams.set('limit', String(Math.min(params.limit, 50)));
  }

  if (params.sort) {
    url.searchParams.set('sort', params.sort);
  }

  if (params.openNow !== undefined) {
    url.searchParams.set('open_now', String(params.openNow));
  }

  if (params.minPrice !== undefined) {
    url.searchParams.set('min_price', String(params.minPrice));
  }

  if (params.maxPrice !== undefined) {
    url.searchParams.set('max_price', String(params.maxPrice));
  }

  if (params.fields) {
    url.searchParams.set('fields', params.fields);
  }

  return url;
}

function formatFoursquareAddress(location: FoursquarePlaceLocation): string | undefined {
  if (location.formatted_address) return location.formatted_address;

  const parts = [location.address, location.locality, location.region, location.postcode].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function foursquareCategoryValue(category: NonNullable<FoursquarePlaceRaw['categories']>[number]): string {
  return category.fsq_category_id ?? category.id ?? category.name;
}

export function normalizeFoursquarePlace(place: FoursquarePlaceRaw): NormalizedFoursquarePlace {
  const id = place.fsq_place_id ?? place.fsq_id;
  if (!id) {
    throw new Error('Foursquare place response missing fsq_place_id');
  }

  const latitude = place.latitude ?? place.geocodes?.main?.latitude;
  const longitude = place.longitude ?? place.geocodes?.main?.longitude;

  return {
    id,
    name: place.name,
    address: place.location ? formatFoursquareAddress(place.location) : undefined,
    location: longitude !== undefined && latitude !== undefined ? [longitude, latitude] : [0, 0],
    categories: place.categories?.map(foursquareCategoryValue),
    distance: place.distance,
    rating: place.rating,
    priceLevel: place.price,
    hours: place.hours
      ? {
          openNow: place.hours.open_now,
          display: place.hours.display,
        }
      : undefined,
    contact: {
      phone: place.tel,
      website: place.website,
    },
    raw: place,
  };
}

export async function searchFoursquarePlaces(
  apiKey: string,
  params: FoursquarePlacesSearchParams
): Promise<NormalizedFoursquarePlace[]> {
  const url = buildFoursquarePlacesSearchUrl(params);
  const response = await fetch(url.toString(), {
    headers: foursquarePlacesHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Place search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as FoursquarePlacesSearchResponse;
  return (data.results ?? []).map(normalizeFoursquarePlace);
}
