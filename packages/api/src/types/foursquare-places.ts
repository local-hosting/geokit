/**
 * Foursquare Places API (places-api.foursquare.com) request/response shapes.
 */

import type { Position } from 'geojson';

export const FOURSQUARE_PLACES_API_BASE = 'https://places-api.foursquare.com';
export const FOURSQUARE_PLACES_API_VERSION = '2025-06-17';

export type FoursquarePlacesSort = 'RELEVANCE' | 'RATING' | 'DISTANCE' | 'POPULARITY';

export interface FoursquarePlacesSearchParams {
  query?: string;
  /** Geokit order: [longitude, latitude] */
  ll?: Position;
  radius?: number;
  categories?: string[];
  limit?: number;
  sort?: FoursquarePlacesSort;
  openNow?: boolean;
  minPrice?: number;
  maxPrice?: number;
  fields?: string;
}

export interface FoursquarePlaceLocation {
  address?: string;
  locality?: string;
  region?: string;
  postcode?: string;
  formatted_address?: string;
}

export interface FoursquarePlaceRaw {
  fsq_place_id?: string;
  fsq_id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude: number; longitude: number } };
  location?: FoursquarePlaceLocation;
  categories?: Array<{ name: string }>;
  distance?: number;
  rating?: number;
  price?: number;
  hours?: { open_now?: boolean; display?: string };
  tel?: string;
  website?: string;
}

export interface FoursquarePlacesSearchResponse {
  results?: FoursquarePlaceRaw[];
}

export interface NormalizedFoursquarePlace {
  id: string;
  name: string;
  address?: string;
  location: [number, number];
  categories?: string[];
  distance?: number;
  rating?: number;
  priceLevel?: number;
  hours?: { openNow?: boolean; display?: string };
  contact?: { phone?: string; website?: string };
  raw: FoursquarePlaceRaw;
}
