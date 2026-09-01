/**
 * Esri ArcGIS Places API (places-service/v1) request/response shapes.
 */

export const ESRI_PLACES_API_BASE =
  'https://places-api.arcgis.com/arcgis/rest/src/providers/places-service/v1';

export const ESRI_PLACES_NEAR_POINT = `${ESRI_PLACES_API_BASE}/places/near-point`;

export interface EsriPlaceCategory {
  categoryId?: string;
  label?: string;
}

export interface EsriPlaceRaw {
  placeId?: string;
  name?: string;
  location?: { x?: number; y?: number };
  categories?: EsriPlaceCategory[];
  distance?: number;
}

export interface EsriPlacesNearPointResponse {
  results?: EsriPlaceRaw[];
}
