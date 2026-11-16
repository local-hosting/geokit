/**
 * Boundary outlines — polygon fill (hit target) + line layer (visual).
 *
 * All gk-layer geo presets (state, county, city, zip) share this stack.
 * Apps supply choropleth fill via mount options (fill color + optional line).
 */

import {
  capPolygonCollectionForMapLibre,
  polygonsToBoundaryLines,
} from '@doppler-group/geokit/core/geojson';
import {
  COUNTY_BOUNDARY_GEOJSON_SOURCE_OPTIONS,
  STATE_BOUNDARY_GEOJSON_SOURCE_OPTIONS,
  ZIP_BOUNDARY_GEOJSON_SOURCE_OPTIONS,
  BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS,
} from '../map-surface/geojson-source-options';
import {
  hasBoundaryOutlineLineLayers,
  restoreBasemapBorders,
  suppressBasemapBorders,
  type BoundaryMapLike,
} from './boundary-map';

/** Nearly invisible fill so interactive layers remain queryable. */
export const BOUNDARY_OUTLINE_HIT_FILL_OPACITY = 0.01;

export const BOUNDARY_OUTLINE_LINE_MIN_ZOOM = 7;

export type BoundaryOutlineSourceOptions = {
  tolerance: number;
  buffer: number;
  maxzoom: number;
};

export type BoundaryOutlineLayerConfig = {
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
  polygonSourceOptions?: BoundaryOutlineSourceOptions;
  lineSourceOptions?: BoundaryOutlineSourceOptions;
};

function lineSourceId(config: Pick<BoundaryOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>) {
  return config.lineSourceId;
}

function resolveLineMinzoom(config: Pick<BoundaryOutlineLayerConfig, 'lineMinzoom' | 'minzoom'>) {
  return config.lineMinzoom ?? config.minzoom ?? BOUNDARY_OUTLINE_LINE_MIN_ZOOM;
}

function lineOpacityExpression(minZoom: number): unknown[] {
  return ['step', ['zoom'], 0, minZoom, 1];
}

export function removeBoundaryOutlineLayer(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    BoundaryOutlineLayerConfig,
    'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'
  >
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.lineLayerId)) map.removeLayer?.(config.lineLayerId);
    if (map.getLayer?.(config.fillLayerId)) map.removeLayer?.(config.fillLayerId);
    if (map.getSource?.(config.lineSourceId)) map.removeSource?.(config.lineSourceId);
    if (map.getSource?.(config.polygonSourceId)) map.removeSource?.(config.polygonSourceId);
    if (!hasBoundaryOutlineLineLayers(map)) {
      restoreBasemapBorders(map);
    }
  } catch {
    /* map torn down */
  }
}

export function applyBoundaryOutlineLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    BoundaryOutlineLayerConfig,
    'lineLayerId' | 'lineColor' | 'lineWidth' | 'lineMinzoom' | 'minzoom'
  >
): void {
  if (!map?.getLayer?.(config.lineLayerId)) return;
  const lineMinzoom = resolveLineMinzoom(config);
  map.setPaintProperty?.(config.lineLayerId, 'line-color', config.lineColor);
  map.setPaintProperty?.(config.lineLayerId, 'line-width', config.lineWidth);
  map.setPaintProperty?.(config.lineLayerId, 'line-opacity', lineOpacityExpression(lineMinzoom));
}

export function refreshBoundaryOutlineData(
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  config: Pick<BoundaryOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>
): GeoJSON.FeatureCollection | null {
  const capped = capPolygonCollectionForMapLibre(polygons);
  map?.getSource?.(config.polygonSourceId)?.setData?.(capped);
  const lines = polygonsToBoundaryLines(polygons);
  map?.getSource?.(lineSourceId(config))?.setData?.(lines);
  return capped;
}

export function addBoundaryOutlineLayer(
  map: BoundaryMapLike,
  polygons: GeoJSON.FeatureCollection,
  config: BoundaryOutlineLayerConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  removeBoundaryOutlineLayer(map, config);

  const capped = capPolygonCollectionForMapLibre(polygons);
  const polygonOptions = config.polygonSourceOptions ?? STATE_BOUNDARY_GEOJSON_SOURCE_OPTIONS;
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
        'fill-opacity': config.fillOpacity ?? BOUNDARY_OUTLINE_HIT_FILL_OPACITY,
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

  // MapTiler basemap borders use a different geometry source — hide them so CDN
  // geojson-vt lines do not moiré/double-stroke against the basemap.
  suppressBasemapBorders(map);

  return capped;
}

export const STATE_BOUNDARY_OUTLINE_SOURCE_OPTIONS = STATE_BOUNDARY_GEOJSON_SOURCE_OPTIONS;
export const COUNTY_BOUNDARY_OUTLINE_SOURCE_OPTIONS = COUNTY_BOUNDARY_GEOJSON_SOURCE_OPTIONS;
export const ZIP_BOUNDARY_OUTLINE_SOURCE_OPTIONS = ZIP_BOUNDARY_GEOJSON_SOURCE_OPTIONS;
