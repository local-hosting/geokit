/**
 * API Provider Types
 *
 * Types and base class for API providers (services)
 */

import type { Position } from 'geojson';

/**
 * Capabilities that API providers can support
 */
export type APICapability = 'isochrone' | 'geocoding' | 'directions' | 'placeSearch';

/**
 * Base provider configuration
 */
export interface MapProviderConfig {
  apiKey?: string;
  accessToken?: string;
  [key: string]: unknown;
}

/**
 * Isochrone request options
 */
export interface IsochroneOptions {
  lat: number;
  lng: number;
  minutes: number[];
  mode: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  colors?: string[];
}

/**
 * Geocoding request options
 */
export interface GeocodeOptions {
  query: string;
  limit?: number;
  types?: string[];
  proximity?: Position;
  bbox?: [number, number, number, number];
}

/**
 * Reverse geocoding request options
 */
export interface ReverseGeocodeOptions {
  lat: number;
  lng: number;
  types?: string[]; // Filter by place types (e.g., 'postcode', 'address')
  limit?: number;
}

/**
 * Reverse geocoding result
 */
export interface ReverseGeocodeResult {
  /** Full formatted address */
  address?: string;
  /** Street address component */
  streetAddress?: string;
  /** City/locality */
  city?: string;
  /** State/region */
  state?: string;
  /** Postal/ZIP code */
  postcode?: string;
  /** Country */
  country?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** Neighborhood/district */
  neighborhood?: string;
  /** Original coordinates */
  coordinates: Position;
  /** Raw provider response */
  raw?: unknown;
}

/**
 * Directions request options
 */
export interface DirectionsOptions {
  waypoints: Position[];
  mode?: 'driving' | 'walking' | 'cycling';
  alternatives?: boolean;
}

/**
 * Place search request options
 */
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

/**
 * Place search result - normalized from provider responses
 */
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

/**
 * Base API Provider - handles service APIs
 * Multiple API providers can be active simultaneously
 * Components use capability-based routing to find the right provider
 */
export abstract class BaseAPIProvider {
  protected config: MapProviderConfig | null = null;

  /**
   * Get the provider name
   */
  abstract getName(): string;

  /**
   * Initialize the provider with configuration
   */
  abstract initialize(config: MapProviderConfig): Promise<void>;

  /**
   * Get the list of capabilities this provider supports
   */
  abstract getCapabilities(): APICapability[];

  /**
   * Fetch isochrone data (travel time polygons)
   * Optional - only implement if provider supports this capability
   */
  fetchIsochrone?(options: IsochroneOptions): Promise<any>;

  /**
   * Check if isochrone data is already cached for given options
   * Optional - useful for prefetch optimization
   */
  hasIsochroneCached?(options: IsochroneOptions): boolean;

  /**
   * Geocode a query string to coordinates
   * Optional - only implement if provider supports this capability
   */
  geocode?(options: GeocodeOptions): Promise<any>;

  /**
   * Reverse geocode coordinates to address/place information
   * Optional - only implement if provider supports this capability
   */
  reverseGeocode?(options: ReverseGeocodeOptions): Promise<ReverseGeocodeResult | null>;

  /**
   * Get directions between waypoints
   * Optional - only implement if provider supports this capability
   */
  directions?(options: DirectionsOptions): Promise<any>;

  /**
   * Search for places/venues
   * Optional - only implement if provider supports this capability
   */
  placeSearch?(options: PlaceSearchOptions): Promise<PlaceSearchResult[]>;
}
