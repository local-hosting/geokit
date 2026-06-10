import type { Bounds } from '@twinfile/geokit/types';
import type {
  MapStaticAutoSnapshotArgs,
  MapStaticBoundsSnapshotArgs,
  MapStaticSnapshotAdapter,
  MapStaticSnapshotArgs,
} from '../../types/map-static-provider.js';
import type { MapStyleId } from '../../types/mcp-map.js';
import {
  DEFAULT_REGION_PATH_STYLE,
  simplifyGeometryRings,
  type MapRegionPathStyle,
} from '../region-path.js';
import {
  staticMapDimensions,
  staticMapImageSuffix,
  staticMapPaddingPx,
  staticMapRefererHeaders,
} from '../static-map-dimensions.js';

const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1';

export const MAPBOX_DEFAULT_STYLE: MapStyleId = 'mapbox/dark-v11';

function normalizeStyle(style: MapStyleId): string {
  if (style.startsWith('http://') || style.startsWith('https://')) {
    throw new Error('Full style URLs are not supported for static map snapshots');
  }
  if (style.includes('/')) return style;
  return `mapbox/${style}`;
}

function decodePathColor(encoded: string): string {
  return encoded.startsWith('%23') ? `#${encoded.slice(3)}` : encoded;
}

function geometryToOverlays(
  geometry: GeoJSON.Geometry,
  options?: { style?: Partial<MapRegionPathStyle> }
): string[] {
  const style = { ...DEFAULT_REGION_PATH_STYLE, ...options?.style };
  const fill = decodePathColor(style.fill);
  const stroke = decodePathColor(style.stroke);

  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    const feature = {
      type: 'Feature',
      geometry,
      properties: {
        stroke,
        'stroke-width': style.width,
        fill,
      },
    };
    return [`geojson(${JSON.stringify(feature)})`];
  }

  const rings = simplifyGeometryRings(geometry);
  if (rings.length === 0) return [];

  const collection = {
    type: 'FeatureCollection',
    features: rings.map((ring) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      properties: {
        stroke,
        'stroke-width': style.width,
        fill,
      },
    })),
  };
  return [`geojson(${JSON.stringify(collection)})`];
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
  return `${MAPBOX_STATIC_BASE}/${style}/static/${segment}/${staticMapImageSuffix(dims)}?access_token=${encodeURIComponent(args.apiKey)}`;
}

function buildBoundsUrl(args: MapStaticBoundsSnapshotArgs): string {
  const style = normalizeStyle(args.style ?? MAPBOX_DEFAULT_STYLE);
  const dims = staticMapDimensions(args.dimensions);
  const [minLon, minLat, maxLon, maxLat] = args.bounds as Bounds;
  const bbox = `[${minLon},${minLat},${maxLon},${maxLat}]`;
  const segment = withOverlays(bbox, args.overlays);
  const paddingPx = staticMapPaddingPx(dims, args.padding);
  return `${MAPBOX_STATIC_BASE}/${style}/static/${segment}/${staticMapImageSuffix(dims)}?access_token=${encodeURIComponent(args.apiKey)}&padding=${paddingPx}`;
}

function buildAutoUrl(args: MapStaticAutoSnapshotArgs): string {
  const style = normalizeStyle(args.style ?? MAPBOX_DEFAULT_STYLE);
  const dims = staticMapDimensions(args.dimensions);
  const segment = withOverlays('auto', args.overlays);
  const paddingPx = staticMapPaddingPx(dims, args.padding);
  return `${MAPBOX_STATIC_BASE}/${style}/static/${segment}/${staticMapImageSuffix(dims)}?access_token=${encodeURIComponent(args.apiKey)}&padding=${paddingPx}`;
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
