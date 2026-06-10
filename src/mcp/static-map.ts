import type { Bounds } from '@twinfile/geokit/types';
import type { MapRenderDimensions, MapStyleId, MapViewport } from '../types/mcp-map.js';

const MAPTILER_STATIC_BASE = 'https://api.maptiler.com/maps';

export const DEFAULT_MAP_STYLE: MapStyleId = 'dataviz-dark';

export const DEFAULT_MAP_DIMENSIONS: MapRenderDimensions = {
  width: 600,
  height: 400,
  format: 'png',
};

/** Padding for geography fit-to-bounds (MapTiler `padding` query + local viewport calc). */
export const DEFAULT_MAP_FIT_PADDING = 0.06;

/**
 * MapTiler path params must stay unencoded (commas in lng,lat pairs; %23 for hex colors).
 * URLSearchParams encodes commas and breaks overlays; literal # truncates the URL at a fragment.
 */
export function appendMaptilerPathParams(baseUrl: string, paths: string[]): string {
  if (paths.length === 0) return baseUrl;
  const pathQuery = paths.map((path) => `path=${path}`).join('&');
  const joiner = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${joiner}${pathQuery}`;
}

function staticDimensions(dims?: Partial<MapRenderDimensions>): MapRenderDimensions {
  return { ...DEFAULT_MAP_DIMENSIONS, ...dims };
}

function staticImageSuffix(dims: MapRenderDimensions): string {
  const scale = dims.scale ?? '';
  const format = dims.format ?? 'png';
  return `${dims.width}x${dims.height}${scale}.${format}`;
}

export function buildMapTilerStaticUrl(args: {
  viewport: MapViewport;
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  apiKey: string;
  paths?: string[];
}): string {
  const style = args.style ?? DEFAULT_MAP_STYLE;
  const dims = staticDimensions(args.dimensions);
  const { lng, lat, zoom } = args.viewport;
  const base = `${MAPTILER_STATIC_BASE}/${style}/static/${lng},${lat},${zoom}/${staticImageSuffix(dims)}?key=${encodeURIComponent(args.apiKey)}`;
  return appendMaptilerPathParams(base, args.paths ?? []);
}

export function buildMapTilerBoundsStaticUrl(args: {
  bounds: Bounds;
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  apiKey: string;
  paths?: string[];
  padding?: number;
}): string {
  const style = args.style ?? DEFAULT_MAP_STYLE;
  const dims = staticDimensions(args.dimensions);
  const [minLon, minLat, maxLon, maxLat] = args.bounds;
  const padding = args.padding ?? DEFAULT_MAP_FIT_PADDING;
  const base = `${MAPTILER_STATIC_BASE}/${style}/static/${minLon},${minLat},${maxLon},${maxLat}/${staticImageSuffix(dims)}?key=${encodeURIComponent(args.apiKey)}&padding=${padding}`;
  return appendMaptilerPathParams(base, args.paths ?? []);
}

/** Auto-fit viewport to path overlays — best for CDN geography polygons. */
export function buildMapTilerAutoStaticUrl(args: {
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  apiKey: string;
  paths: string[];
  padding?: number;
}): string {
  const style = args.style ?? DEFAULT_MAP_STYLE;
  const dims = staticDimensions(args.dimensions);
  const padding = args.padding ?? DEFAULT_MAP_FIT_PADDING;
  const base = `${MAPTILER_STATIC_BASE}/${style}/static/auto/${staticImageSuffix(dims)}?key=${encodeURIComponent(args.apiKey)}&padding=${padding}`;
  return appendMaptilerPathParams(base, args.paths);
}

export function buildMapMarkdownImage(args: {
  imageUrl: string;
  label?: string;
  viewport: MapViewport;
}): string {
  const alt =
    args.label ??
    `Map at ${args.viewport.lat.toFixed(4)}, ${args.viewport.lng.toFixed(4)} zoom ${args.viewport.zoom}`;
  return `![${alt}](${args.imageUrl})`;
}
