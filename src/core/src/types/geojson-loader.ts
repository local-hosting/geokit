import type { ViewportBounds } from '@twinfile/geokit/h3/lite';

export type ViewportContext = {
  bounds: ViewportBounds;
  centerLat: number;
  centerLng: number;
  zoom: number;
  signal?: AbortSignal;
};

export type GeoJsonLoadRequest =
  | { scope: 'static' }
  | { scope: 'viewport'; viewport: ViewportContext }
  | { scope: 'ids'; ids: string[] };

export type GeoJsonLoaderResult = {
  collection: GeoJSON.FeatureCollection;
  partial?: boolean;
  meta?: Record<string, unknown>;
};

export type GeoJsonLoader = (
  request: GeoJsonLoadRequest
) => Promise<GeoJsonLoaderResult | null>;

export type GeoJsonLoaderContext = {
  baseUrl?: string;
  getRequestInit?: () => RequestInit;
  init?: RequestInit;
};
