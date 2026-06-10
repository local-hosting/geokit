/**
 * Map view types for MCP static snapshots and optional interactive host URLs.
 */

export type MapStaticFormat = 'png' | 'jpg' | 'webp';

export type MapStyleId = 'dataviz-dark' | 'dataviz' | 'streets-v4' | 'satellite' | string;

export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

export interface MapRenderDimensions {
  width: number;
  height: number;
  scale?: '@2x' | '';
  format?: MapStaticFormat;
}

export interface MapViewInput {
  lat?: number;
  lng?: number;
  zoom?: number;
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds?: [number, number, number, number];
  /** US county FIPS (e.g. 36047 Kings / Brooklyn) — resolved via geokit CDN shapes */
  countyFips?: string;
  /** US state code when using place slug */
  state?: string;
  /** Place slug from CDN state cities catalog (e.g. new-york) */
  place?: string;
  style?: MapStyleId;
  width?: number;
  height?: number;
  label?: string;
  theme?: 'light' | 'dark';
}

export interface MapViewConfig extends MapViewport, MapRenderDimensions {
  style: MapStyleId;
}

export interface MapMcpRenderOptions {
  maptilerKey: string;
  fetchImage?: boolean;
  /** Referer for MapTiler static fetch when keys are referrer-restricted. */
  referer?: string;
  /** Globe CDN base for resolving region shapes (countyFips, state+place). */
  cdnBaseUrl?: string;
}

export interface MapMcpRenderResult {
  viewport: MapViewport;
  style: MapStyleId;
  width: number;
  height: number;
  imageUrl: string;
  markdown: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface MapHostConfig extends MapViewConfig {
  theme?: 'light' | 'dark';
}
