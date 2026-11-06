import type { Bounds } from '../../types/index';
import type { Position } from 'geojson';
import type {
  MapStaticAutoSnapshotArgs,
  MapStaticBoundsSnapshotArgs,
  MapStaticSnapshotAdapter,
  MapStaticSnapshotArgs,
} from '../../types/static-map';
import { resolveMapboxStaticStyle } from '../basemap';
import type { MapStyleId } from '../../types/static-map';
import {
  DEFAULT_REGION_PATH_STYLE,
  encodePolyline,
  simplifyGeometryRings,
  type MapRegionPathStyle,
} from '../region-path';
import {
  staticMapDimensions,
  staticMapImageSuffix,
  staticMapPaddingPx,
  staticMapRefererHeaders,
} from '../dimensions';

const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1';

function mapboxImageSuffix(dims: ReturnType<typeof staticMapDimensions>): string {
  const scale = dims.scale ?? '';
  return `${dims.width}x${dims.height}${scale}`;
}

export const MAPBOX_DEFAULT_STYLE: MapStyleId = resolveMapboxStaticStyle();

function normalizeStyle(style: MapStyleId): string {
  if (style.startsWith('http://') || style.startsWith('https://')) {
    throw new Error('Full style URLs are not supported for static map snapshots');
  }
  if (style.startsWith('mapbox://styles/')) {
    return style.slice('mapbox://styles/'.length);
  }
  if (style.includes('/')) return style;
  return `mapbox/${style}`;
}

function decodePathColor(encoded: string): string {
  return encoded.startsWith('%23') ? `#${encoded.slice(3)}` : encoded;
}

function parsePathColor(encoded: string): { rgb: string; opacity: number } {
  const hex = decodePathColor(encoded).replace('#', '');
  if (hex.length === 8) {
    return {
      rgb: hex.slice(0, 6),
      opacity: Number.parseInt(hex.slice(6, 8), 16) / 255,
    };
  }
  if (hex.length === 6) {
    return { rgb: hex, opacity: 1 };
  }
  throw new Error(`Invalid map path color "${encoded}"`);
}

function ringToMapboxPathOverlay(ring: Position[], style: MapRegionPathStyle): string {
  const closedRing: Position[] = [...ring];
  if (closedRing.length > 0) {
    const [firstLon, firstLat] = closedRing[0]!;
    const [lastLon, lastLat] = closedRing[closedRing.length - 1]!;
    if (firstLon !== lastLon || firstLat !== lastLat) {
      closedRing.push(closedRing[0]!);
    }
  }

  const stroke = parsePathColor(style.stroke);
  const fill = parsePathColor(style.fill);
  const polyline = encodeURIComponent(
    encodePolyline(closedRing.map(([lon, lat]) => [lat, lon] as [number, number]))
  );

  return `path-${style.width}+${stroke.rgb}-${stroke.opacity}+${fill.rgb}-${fill.opacity}(${polyline})`;
}

function geometryToPathOverlays(
  geometry: GeoJSON.Geometry,
  options?: {
    maxPointsPerRing?: number;
    style?: Partial<MapRegionPathStyle>;
  }
): string[] {
  const style = { ...DEFAULT_REGION_PATH_STYLE, ...options?.style };
  return simplifyGeometryRings(geometry, options).map((ring) =>
    ringToMapboxPathOverlay(ring, style)
  );
}

function geometryToOverlays(
  geometry: GeoJSON.Geometry,
  options?: { style?: Partial<MapRegionPathStyle> }
): string[] {
  return geometryToPathOverlays(geometry, options);
}

function withOverlays(segment: string, overlays: string[] | undefined): string {
  if (!overlays?.length) return segment;
  return `${overlays.join(',')}/${segment}`;
}

function buildCenterUrl(args: MapStaticSnapshotArgs): string {
  const style = normalizeStyle(args.style ?? MAPBOX_DEFAULT_STYLE);
  const dims = staticMapDimensions(args.dimensions);
  const { lng, lat, zoom } = args.viewport;
  const segment = withOverlays(`${lng},${lat},${zoom},0,0`, args.overlays);
  return `${MAPBOX_STATIC_BASE}/${style}/static/${segment}/${mapboxImageSuffix(dims)}?access_token=${encodeURIComponent(args.apiKey)}`;
}

function buildBoundsUrl(args: MapStaticBoundsSnapshotArgs): string {
  const style = normalizeStyle(args.style ?? MAPBOX_DEFAULT_STYLE);
  const dims = staticMapDimensions(args.dimensions);
  const [minLon, minLat, maxLon, maxLat] = args.bounds as Bounds;
  const bbox = `[${minLon},${minLat},${maxLon},${maxLat}]`;
  const segment = withOverlays(bbox, args.overlays);
  const paddingPx = staticMapPaddingPx(dims, args.padding);
  return `${MAPBOX_STATIC_BASE}/${style}/static/${segment}/${mapboxImageSuffix(dims)}?access_token=${encodeURIComponent(args.apiKey)}&padding=${paddingPx}`;
}

function buildAutoUrl(args: MapStaticAutoSnapshotArgs): string {
  const style = normalizeStyle(args.style ?? MAPBOX_DEFAULT_STYLE);
  const dims = staticMapDimensions(args.dimensions);
  const segment = withOverlays('auto', args.overlays);
  const paddingPx = staticMapPaddingPx(dims, args.padding);
  return `${MAPBOX_STATIC_BASE}/${style}/static/${segment}/${mapboxImageSuffix(dims)}?access_token=${encodeURIComponent(args.apiKey)}&padding=${paddingPx}`;
}

export const mapboxStaticAdapter: MapStaticSnapshotAdapter = {
  id: 'mapbox',
  defaultStyle: MAPBOX_DEFAULT_STYLE,
  geometryToOverlays,
  buildCenterUrl,
  buildBoundsUrl,
  buildAutoUrl,
  staticFetchHeaders: (referer) => staticMapRefererHeaders(referer),
};
