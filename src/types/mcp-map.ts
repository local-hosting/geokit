/**
 * Map view types for MCP static snapshots and optional interactive host URLs.
 */

import type { ResolvedMapStaticProvider } from './map-static-provider.js';

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
  /** Place slug from CDN state cities catalog (e.g. new-york) — with state */
  place?: string;
  /** Free-text place, address, or DMA hint — geocoded when lat/lng and CDN fields are absent */
  query?: string;
  /** Region outline from geocode or DMA resolution (set by resolveMapViewInput) */
  regionGeometry?: GeoJSON.Geometry;
  /** Interactive host layer from geocode or DMA resolution (set by resolveMapViewInput) */
  regionLayer?: MapHostRegionLayer;
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
  provider: ResolvedMapStaticProvider;
  fetchImage?: boolean;
  /** Referer override for static fetch when keys are referrer-restricted. */
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
  provider: ResolvedMapStaticProvider['id'];
  imageBase64?: string;
  mimeType?: string;
}

export interface MapHostConfig extends MapViewConfig {
  theme?: 'light' | 'dark';
}

/** CDN outline layer for the interactive map host (show_map / open_map). */
export type MapHostRegionLayer =
  | { dataset: 'dma'; mode: 'viewport' }
  | { dataset: 'dma'; slug: string; region?: string }
  | { dataset: 'place'; state: string; slug: string }
  | { dataset: 'state'; slug: string }
  | { dataset: 'zip'; slug: string }
  | { dataset: 'county'; fips: string };
