/**
 * Admin boundary outlines — polygon fill-outline on GeoJSON sources.
 *
 * Client geojson-vt slices polygons at tile edges; CDN fill-outline fragments at
 * continent zoom. State preset uses basemap admin borders for visuals at all zooms.
 */

import type { BoundaryMapLike } from './boundary-map';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from './geojson-source-options';

/** Transparent fill; outline paints when fill-outline-color is non-transparent. */
export const BOUNDARY_OUTLINE_FILL_OPACITY = 1;

export const BOUNDARY_OUTLINE_MIN_ZOOM = 7;

export type BoundaryOutlinePaintConfig = {
  sourceId: string;
  lineLayerId: string;
  lineColor: string;
  lineWidth: number | unknown[];
  minzoom?: number;
  /** Zoom at which CDN outline paints (county/city). Default 7. */
  minOutlineZoom?: number;
  /**
   * State preset: basemap draws outlines at every zoom; CDN layer is hit-target only.
   */
  useBasemapOutline?: boolean;
};

const TRANSPARENT_OUTLINE = 'rgba(0, 0, 0, 0)';

function outlineColorExpression(lineColor: string, minOutlineZoom: number): unknown[] {
  return ['step', ['zoom'], TRANSPARENT_OUTLINE, minOutlineZoom, lineColor];
}

function resolveOutlinePaint(
  config: Pick<BoundaryOutlinePaintConfig, 'lineColor' | 'minOutlineZoom' | 'useBasemapOutline'>
): unknown[] | string {
  if (config.useBasemapOutline) return TRANSPARENT_OUTLINE;
  const minOutlineZoom = config.minOutlineZoom ?? BOUNDARY_OUTLINE_MIN_ZOOM;
  return outlineColorExpression(config.lineColor, minOutlineZoom);
}

export function removeBoundaryOutlineLayer(
  map: BoundaryMapLike | null | undefined,
  config: Pick<BoundaryOutlinePaintConfig, 'sourceId' | 'lineLayerId'>
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.lineLayerId)) map.removeLayer?.(config.lineLayerId);
    if (map.getSource?.(config.sourceId)) map.removeSource?.(config.sourceId);
  } catch {
    /* map torn down */
  }
}

export function setBoundaryOutlineLineOpacity(
  map: BoundaryMapLike | null | undefined,
  lineLayerId: string,
  opacity: number
): void {
  if (!map?.getLayer?.(lineLayerId)) return;
  map.setPaintProperty?.(
    lineLayerId,
    'fill-opacity',
    opacity <= 0 ? 0 : BOUNDARY_OUTLINE_FILL_OPACITY
  );
}

export function applyBoundaryOutlineLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    BoundaryOutlinePaintConfig,
    'lineLayerId' | 'lineColor' | 'lineWidth' | 'minOutlineZoom' | 'useBasemapOutline'
  >
): void {
  if (!map?.getLayer?.(config.lineLayerId)) return;
  map.setPaintProperty?.(config.lineLayerId, 'fill-outline-color', resolveOutlinePaint(config));
  map.setPaintProperty?.(config.lineLayerId, 'fill-opacity', BOUNDARY_OUTLINE_FILL_OPACITY);
  void config.lineWidth;
}

export function refreshBoundaryOutlineData(
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  sourceId: string
): GeoJSON.FeatureCollection | null {
  map?.getSource?.(sourceId)?.setData?.(polygons);
  return polygons;
}

export function addBoundaryOutlineLayer(
  map: BoundaryMapLike,
  polygons: GeoJSON.FeatureCollection,
  config: BoundaryOutlinePaintConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  removeBoundaryOutlineLayer(map, config);

  map.addSource?.(config.sourceId, {
    type: 'geojson',
    data: polygons,
    ...BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS,
  });

  const before = beforeLayerId && map.getLayer?.(beforeLayerId) ? beforeLayerId : undefined;
  map.addLayer?.(
    {
      id: config.lineLayerId,
      type: 'fill',
      source: config.sourceId,
      ...(config.minzoom != null ? { minzoom: config.minzoom } : {}),
      paint: {
        'fill-color': 'rgba(0, 0, 0, 0)',
        'fill-opacity': BOUNDARY_OUTLINE_FILL_OPACITY,
        'fill-outline-color': resolveOutlinePaint(config),
        'fill-antialias': true,
      },
    },
    before
  );

  return polygons;
}
