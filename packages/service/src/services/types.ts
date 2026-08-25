/**
 * Geokit service types — request/response shapes for outbound HTTP integrations.
 */

import type { Position } from 'geojson';

export { Service, CachedService, type CachedServiceOptions } from './service';

export type ServiceCapability = 'isochrone' | 'geocoding' | 'directions' | 'placeSearch';

export interface ServiceConfig {
  apiKey?: string;
  accessToken?: string;
  [key: string]: unknown;
}

export interface IsochroneOptions {
  lat: number;
  lng: number;
  minutes: number[];
  mode: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  colors?: string[];
}

export interface GeocodeOptions {
  query: string;
  limit?: number;
  types?: string[];
  proximity?: Position;
  bbox?: [number, number, number, number];
  polygons?: boolean;
}

export interface ReverseGeocodeOptions {
  lat: number;
  lng: number;
  types?: string[];
  limit?: number;
}

export interface ReverseGeocodeResult {
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
  neighborhood?: string;
  coordinates: Position;
  raw?: unknown;
}

export interface DirectionsOptions {
  waypoints: Position[];
  mode?: 'driving' | 'walking' | 'cycling';
  alternatives?: boolean;
}

export interface PlaceSearchOptions {
  query?: string;
  ll?: Position;
  radius?: number;
  categories?: string[];
  limit?: number;
  sort?: 'RELEVANCE' | 'RATING' | 'DISTANCE';
  openNow?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address?: string;
  location: Position;
  categories?: string[];
  distance?: number;
  rating?: number;
  priceLevel?: number;
  hours?: {
    openNow?: boolean;
    display?: string;
  };
  contact?: {
    phone?: string;
    website?: string;
  };
  raw?: unknown;
}
