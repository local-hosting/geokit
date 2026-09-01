/**
 * Static map snapshot types (provider-agnostic).
 */

import type { Bounds } from './index';
import type { MapStaticProviderId } from './map-provider';

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

export interface MapStaticSnapshotArgs {
  viewport: MapViewport;
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  apiKey: string;
  overlays?: string[];
}

export interface MapStaticBoundsSnapshotArgs {
  bounds: Bounds;
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  apiKey: string;
  overlays?: string[];
  padding?: number;
}

export interface MapStaticAutoSnapshotArgs {
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  apiKey: string;
  overlays: string[];
  padding?: number;
}

export interface MapStaticSnapshotAdapter {
  readonly id: MapStaticProviderId;
  defaultStyle: MapStyleId;
  geometryToOverlays(
    geometry: GeoJSON.Geometry,
    options?: { style?: Partial<MapRegionPathStyle> }
  ): string[];
  buildCenterUrl(args: MapStaticSnapshotArgs): string;
  buildBoundsUrl(args: MapStaticBoundsSnapshotArgs): string;
  buildAutoUrl(args: MapStaticAutoSnapshotArgs): string;
  staticFetchHeaders(referer: string | undefined): HeadersInit | undefined;
}

export interface ResolvedMapStaticProvider {
  id: MapStaticProviderId;
  apiKey: string;
  referer?: string;
  styleUrl?: string;
  adapter: MapStaticSnapshotAdapter;
}

export type MapRegionPathStyle = {
  fill: string;
  stroke: string;
  width: number;
};
