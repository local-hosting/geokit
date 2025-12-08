/**
 * API Provider Types
 * 
 * Types and base class for API providers (services)
 */

import type { Position } from 'geojson';

/**
 * Capabilities that API providers can support
 */
export type APICapability = 'isochrone' | 'geocoding' | 'directions' | 'matrix' | 'elevation';

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
 * Directions request options
 */
export interface DirectionsOptions {
  waypoints: Position[];
  mode?: 'driving' | 'walking' | 'cycling';
  alternatives?: boolean;
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
   * Geocode a query string to coordinates
   * Optional - only implement if provider supports this capability
   */
  geocode?(options: GeocodeOptions): Promise<any>;

  /**
   * Get directions between waypoints
   * Optional - only implement if provider supports this capability
   */
  directions?(options: DirectionsOptions): Promise<any>;

  /**
   * Get elevation for coordinates
   * Optional - only implement if provider supports this capability
   */
  elevation?(coordinates: Position[]): Promise<number[]>;
}

