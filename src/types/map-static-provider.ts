/**
 * Provider-agnostic static map snapshot types for MCP tools.
 */

import type { Bounds } from '@twinfile/geokit/types';
import type { MapRenderDimensions, MapStyleId, MapViewport } from './mcp-map.js';

export type MapStaticProviderId = 'maptiler' | 'mapbox';

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
    options?: { style?: Partial<{ fill: string; stroke: string; width: number }> }
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
  adapter: MapStaticSnapshotAdapter;
}
