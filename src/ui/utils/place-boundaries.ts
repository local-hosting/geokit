/**
 * Place / city outline layers — `/us/state/{code}/**` CDN namespace.
 */

import { polygonsToBoundaryLines } from '../../utils/geojson/boundary-lines';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from './geojson-source-options';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type PlaceBoundaryConfig = {
  sourceId: string;
  lineLayerId: string;
  lineColor: string;
  lineWidth: number | unknown[];
};

export function removePlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  config: Pick<PlaceBoundaryConfig, 'sourceId' | 'lineLayerId'>
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.lineLayerId)) map.removeLayer?.(config.lineLayerId);
    if (map.getSource?.(config.sourceId)) map.removeSource?.(config.sourceId);
  } catch {
    /* map torn down */
  }
}

export function setPlaceLineOpacity(
  map: BoundaryMapLike | null | undefined,
  lineLayerId: string,
  opacity: number
): void {
  if (!map?.getLayer?.(lineLayerId)) return;
  map.setPaintProperty?.(lineLayerId, 'line-opacity', opacity);
}

export function refreshPlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  sourceId: string
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const lines = polygonsToBoundaryLines(cities);
  map?.getSource?.(sourceId)?.setData?.(lines);
  return lines;
}

export function ensurePlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: PlaceBoundaryConfig,
  beforeLayerId?: string,
  lineOpacity = 1
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const lines = polygonsToBoundaryLines(cities);
  if (!isBoundaryMapReady(map)) return lines;

  if (!map!.getSource?.(config.sourceId)) {
    map!.addSource?.(config.sourceId, {
      type: 'geojson',
      data: lines,
      ...BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS,
    });

    const before = beforeLayerId && map!.getLayer?.(beforeLayerId) ? beforeLayerId : undefined;
    map!.addLayer?.(
      {
        id: config.lineLayerId,
        type: 'line',
        source: config.sourceId,
        paint: {
          'line-color': config.lineColor,
          'line-width': config.lineWidth,
          'line-opacity': lineOpacity,
        },
      },
      before
    );
    return lines;
  }

  refreshPlaceBoundaries(map, cities, config.sourceId);
  setPlaceLineOpacity(map, config.lineLayerId, lineOpacity);
  return lines;
}
