import type { Bounds } from '../../types/index';
import type { Position } from 'geojson';
import type {
  MapStaticAutoSnapshotArgs,
  MapStaticBoundsSnapshotArgs,
  MapStaticSnapshotAdapter,
  MapStaticSnapshotArgs,
} from '../../types/static-map';
import type { MapStyleId } from '../../types/static-map';
import {
  DEFAULT_REGION_PATH_STYLE,
  simplifyGeometryRings,
  type MapRegionPathStyle,
} from '../region-path';
import { resolveMaptilerStaticMapsBase } from '../basemap';
import {
  staticMapDimensions,
  staticMapImageSuffix,
  staticMapRefererHeaders,
} from '../dimensions';

export const MAPTILER_DEFAULT_STYLE: MapStyleId = 'dataviz-dark';

function maptilerStaticMapsBase(): string {
  return resolveMaptilerStaticMapsBase();
}

export type { MapRegionPathStyle };

/**
 * Path params must stay unencoded (commas in lng,lat pairs; %23 for hex colors).
 * URLSearchParams encodes commas and breaks overlays; literal # truncates the URL at a fragment.
 */
function appendPathOverlays(baseUrl: string, overlays: string[]): string {
  if (overlays.length === 0) return baseUrl;
  const pathQuery = overlays.map((overlay) => `path=${overlay}`).join('&');
  const joiner = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${joiner}${pathQuery}`;
}

function ringToPathOverlay(ring: Position[], style: MapRegionPathStyle): string {
  const pairs = ring.map(([lon, lat]) => `${lon},${lat}`);
  const stylePrefix = [`fill:${style.fill}`, `stroke:${style.stroke}`, `width:${style.width}`].join(
    '|'
  );
  return `${stylePrefix}|${pairs.join('|')}`;
}

function geometryToPathOverlays(
  geometry: GeoJSON.Geometry,
  options?: {
    maxPointsPerRing?: number;
    style?: Partial<MapRegionPathStyle>;
  }
): string[] {
  const style = { ...DEFAULT_REGION_PATH_STYLE, ...options?.style };
  return simplifyGeometryRings(geometry, options).map((ring) => ringToPathOverlay(ring, style));
}

function buildCenterUrl(args: MapStaticSnapshotArgs): string {
  const style = args.style ?? MAPTILER_DEFAULT_STYLE;
  const dims = staticMapDimensions(args.dimensions);
  const { lng, lat, zoom } = args.viewport;
  const base = `${maptilerStaticMapsBase()}/${style}/static/${lng},${lat},${zoom}/${staticMapImageSuffix(dims)}?key=${encodeURIComponent(args.apiKey)}`;
  return appendPathOverlays(base, args.overlays ?? []);
}

function buildBoundsUrl(args: MapStaticBoundsSnapshotArgs): string {
  const style = args.style ?? MAPTILER_DEFAULT_STYLE;
  const dims = staticMapDimensions(args.dimensions);
  const [minLon, minLat, maxLon, maxLat] = args.bounds as Bounds;
  const padding = args.padding ?? 0.06;
  const base = `${maptilerStaticMapsBase()}/${style}/static/${minLon},${minLat},${maxLon},${maxLat}/${staticMapImageSuffix(dims)}?key=${encodeURIComponent(args.apiKey)}&padding=${padding}`;
  return appendPathOverlays(base, args.overlays ?? []);
}

function buildAutoUrl(args: MapStaticAutoSnapshotArgs): string {
  const style = args.style ?? MAPTILER_DEFAULT_STYLE;
  const dims = staticMapDimensions(args.dimensions);
  const padding = args.padding ?? 0.06;
  const base = `${maptilerStaticMapsBase()}/${style}/static/auto/${staticMapImageSuffix(dims)}?key=${encodeURIComponent(args.apiKey)}&padding=${padding}`;
  return appendPathOverlays(base, args.overlays);
}

export const maptilerStaticAdapter: MapStaticSnapshotAdapter = {
  id: 'maptiler',
  defaultStyle: MAPTILER_DEFAULT_STYLE,
  geometryToOverlays: geometryToPathOverlays,
  buildCenterUrl,
  buildBoundsUrl,
  buildAutoUrl,
  staticFetchHeaders: (referer) => staticMapRefererHeaders(referer, { includeOrigin: true }),
};
