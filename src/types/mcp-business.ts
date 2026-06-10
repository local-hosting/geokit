/**
 * Business-friendly MCP tool types (non-GIS users).
 */

export interface ResolvedPlace {
  lat: number;
  lng: number;
  label: string;
}

/** Place resolved for map display — may frame a region instead of a pin. */
export interface ResolvedMapPlace extends ResolvedPlace {
  bounds?: [number, number, number, number];
  scope: 'point' | 'region';
}

export interface BusinessMapSnapshot {
  summary: string;
  markdown: string;
  imageUrl: string;
  imageBase64?: string;
  mimeType?: string;
  hostUrl?: string;
  lat: number;
  lng: number;
  zoom: number;
}

export interface NearbyPlaceRow {
  name: string;
  distanceMiles: number;
  address?: string;
  rating?: number;
}

export interface AreaComparisonRow {
  label: string;
  lat: number;
  lng: number;
  straightLineMiles?: number;
  driveMinutes?: number;
  radiusMiles?: number;
  areaSqMiles?: number;
}
