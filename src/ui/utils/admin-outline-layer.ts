/**
 * CDN admin outlines — polygon fill (hit target) + line layer (visual).
 *
 * All gk-layer geo presets (state, county, place, zip) share this stack.
 * DMA remains the only choropleth preset (fill color + optional line).
 */

import {
  capPolygonCollectionForMapLibre,
  polygonsToBoundaryLines,
} from '../../utils/geojson/boundary-lines';
import {
  ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS,
  ADMIN_STATE_GEOJSON_SOURCE_OPTIONS,
  ADMIN_ZIP_GEOJSON_SOURCE_OPTIONS,
  BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS,
} from './geojson-source-options';
import {
  hasAdminOutlineLineLayers,
  restoreBasemapAdminBorders,
  suppressBasemapBorders,
  type BoundaryMapLike,
} from './boundary-map';

/** Nearly invisible fill so interactive layers remain queryable. */
export const ADMIN_OUTLINE_HIT_FILL_OPACITY = 0.01;

export const ADMIN_OUTLINE_LINE_MIN_ZOOM = 7;

export type AdminOutlineSourceOptions = {
  tolerance: number;
  buffer: number;
  maxzoom: number;
};

export type AdminOutlineLayerConfig = {
  polygonSourceId: string;
  lineSourceId: string;
  fillLayerId: string;
  lineLayerId: string;
  lineColor: string;
  lineWidth: number | unknown[];
  minzoom?: number;
  /** Zoom at which CDN line paint becomes visible. Default 7. */
  lineMinzoom?: number;
  fillColor?: string | unknown[];
  fillOpacity?: number;
  polygonSourceOptions?: AdminOutlineSourceOptions;
  lineSourceOptions?: AdminOutlineSourceOptions;
};

function lineSourceId(config: Pick<AdminOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>) {
  return config.lineSourceId;
}

function resolveLineMinzoom(config: Pick<AdminOutlineLayerConfig, 'lineMinzoom' | 'minzoom'>) {
  return config.lineMinzoom ?? config.minzoom ?? ADMIN_OUTLINE_LINE_MIN_ZOOM;
}

function lineOpacityExpression(minZoom: number): unknown[] {
  return ['step', ['zoom'], 0, minZoom, 1];
}

export function removeAdminOutlineLayer(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    AdminOutlineLayerConfig,
    'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'
  >
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.lineLayerId)) map.removeLayer?.(config.lineLayerId);
    if (map.getLayer?.(config.fillLayerId)) map.removeLayer?.(config.fillLayerId);
    if (map.getSource?.(config.lineSourceId)) map.removeSource?.(config.lineSourceId);
    if (map.getSource?.(config.polygonSourceId)) map.removeSource?.(config.polygonSourceId);
    if (!hasAdminOutlineLineLayers(map)) {
      restoreBasemapAdminBorders(map);
    }
  } catch {
    /* map torn down */
  }
}

export function applyAdminOutlineLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    AdminOutlineLayerConfig,
    'lineLayerId' | 'lineColor' | 'lineWidth' | 'lineMinzoom' | 'minzoom'
  >
): void {
  if (!map?.getLayer?.(config.lineLayerId)) return;
  const lineMinzoom = resolveLineMinzoom(config);
  map.setPaintProperty?.(config.lineLayerId, 'line-color', config.lineColor);
  map.setPaintProperty?.(config.lineLayerId, 'line-width', config.lineWidth);
  map.setPaintProperty?.(config.lineLayerId, 'line-opacity', lineOpacityExpression(lineMinzoom));
}

export function refreshAdminOutlineData(
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  config: Pick<AdminOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>
): GeoJSON.FeatureCollection | null {
  const capped = capPolygonCollectionForMapLibre(polygons);
  map?.getSource?.(config.polygonSourceId)?.setData?.(capped);
  const lines = polygonsToBoundaryLines(polygons);
  map?.getSource?.(lineSourceId(config))?.setData?.(lines);
  return capped;
}

export function addAdminOutlineLayer(
  map: BoundaryMapLike,
  polygons: GeoJSON.FeatureCollection,
  config: AdminOutlineLayerConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  removeAdminOutlineLayer(map, config);

  const capped = capPolygonCollectionForMapLibre(polygons);
  const polygonOptions = config.polygonSourceOptions ?? ADMIN_STATE_GEOJSON_SOURCE_OPTIONS;
  const lineOptions = config.lineSourceOptions ?? BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS;
  const lines = polygonsToBoundaryLines(polygons);
  const before = beforeLayerId && map.getLayer?.(beforeLayerId) ? beforeLayerId : undefined;
  const lineMinzoom = resolveLineMinzoom(config);

  map.addSource?.(config.polygonSourceId, {
    type: 'geojson',
    data: capped,
    ...polygonOptions,
  });

  map.addSource?.(config.lineSourceId, {
    type: 'geojson',
    data: lines,
    ...lineOptions,
  });

  map.addLayer?.(
    {
      id: config.fillLayerId,
      type: 'fill',
      source: config.polygonSourceId,
      ...(config.minzoom != null ? { minzoom: config.minzoom } : {}),
      paint: {
        'fill-color': config.fillColor ?? 'rgba(0, 0, 0, 0)',
        'fill-opacity': config.fillOpacity ?? ADMIN_OUTLINE_HIT_FILL_OPACITY,
        'fill-antialias': false,
      },
    },
    before
  );

  map.addLayer?.(
    {
      id: config.lineLayerId,
      type: 'line',
      source: config.lineSourceId,
      ...(config.minzoom != null ? { minzoom: config.minzoom } : {}),
      paint: {
        'line-color': config.lineColor,
        'line-width': config.lineWidth,
        'line-opacity': lineOpacityExpression(lineMinzoom),
      },
      layout: { 'line-join': 'round', 'line-cap': 'round' },
    },
    before
  );

  // MapTiler admin borders use a different geometry source — hide them so CDN
  // geojson-vt lines do not moiré/double-stroke against the basemap.
  suppressBasemapBorders(map);

  return capped;
}

export const ADMIN_STATE_OUTLINE_SOURCE_OPTIONS = ADMIN_STATE_GEOJSON_SOURCE_OPTIONS;
export const ADMIN_COUNTY_OUTLINE_SOURCE_OPTIONS = ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS;
export const ADMIN_ZIP_OUTLINE_SOURCE_OPTIONS = ADMIN_ZIP_GEOJSON_SOURCE_OPTIONS;
