/**
 * Minimal API result types for business MCP fetch helpers.
 */

export interface ReverseGeocodeResult {
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
  neighborhood?: string;
  coordinates: [number, number];
  raw?: unknown;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address?: string;
  location: [number, number];
  categories?: string[];
  distance?: number;
  rating?: number;
}
