import type { Bounds } from '../types/index';
import type {
  MapStaticAutoSnapshotArgs,
  MapStaticBoundsSnapshotArgs,
  MapStaticSnapshotAdapter,
  MapStaticSnapshotArgs,
  ResolvedMapStaticProvider,
} from '../types/static-map';
import { resolveMapboxStaticStyle } from './basemap';
import type { MapRenderDimensions, MapStyleId, MapViewport } from '../types/static-map';

export const DEFAULT_MAP_STYLE: MapStyleId = resolveMapboxStaticStyle();

export const DEFAULT_MAP_DIMENSIONS: MapRenderDimensions = {
  width: 600,
  height: 400,
  format: 'png',
};

/** Padding for geography fit-to-bounds (provider `padding` query + local viewport calc). */
export const DEFAULT_MAP_FIT_PADDING = 0.06;

export function buildStaticCenterUrl(
  provider: MapStaticSnapshotAdapter,
  args: MapStaticSnapshotArgs
): string {
  return provider.buildCenterUrl(args);
}

export function buildStaticBoundsUrl(
  provider: MapStaticSnapshotAdapter,
  args: MapStaticBoundsSnapshotArgs
): string {
  return provider.buildBoundsUrl(args);
}

export function buildStaticAutoUrl(
  provider: MapStaticSnapshotAdapter,
  args: MapStaticAutoSnapshotArgs
): string {
  return provider.buildAutoUrl(args);
}

export function buildStaticSnapshotUrl(args: {
  provider: ResolvedMapStaticProvider;
  viewport: MapViewport;
  style?: MapStyleId;
  dimensions?: Partial<MapRenderDimensions>;
  bounds?: Bounds;
  overlays?: string[];
  fitGeography: boolean;
  padding?: number;
}): string {
  const { provider, viewport, style, dimensions, bounds, overlays, fitGeography, padding } = args;
  const apiKey = provider.apiKey;
  const adapter = provider.adapter;
  const resolvedStyle = style ?? adapter.defaultStyle;
  const snapshotArgs = { style: resolvedStyle, dimensions, apiKey, overlays, padding };

  if (overlays?.length && fitGeography) {
    return buildStaticAutoUrl(adapter, {
      ...snapshotArgs,
      overlays,
    });
  }

  if (bounds && fitGeography) {
    return buildStaticBoundsUrl(adapter, {
      ...snapshotArgs,
      bounds,
    });
  }

  return buildStaticCenterUrl(adapter, {
    ...snapshotArgs,
    viewport,
  });
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

export * from './dimensions';
export * from './region-path';
export * from './overlays';
export { mapboxStaticAdapter, MAPBOX_DEFAULT_STYLE } from './providers/mapbox';
export { maptilerStaticAdapter, MAPTILER_DEFAULT_STYLE } from './providers/maptiler';
