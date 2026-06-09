/**
 * US state outline layers — `/us/state/**` CDN namespace.
 */

import { polygonsToBoundaryLines } from '../../utils/geojson/boundary-lines';
import { ADMIN_STATE_GEOJSON_SOURCE_OPTIONS } from './geojson-source-options';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type StateBoundaryConfig = {
  sourceId: string;
  lineLayerId: string;
  lineColor: string;
  lineWidth: number | unknown[];
};

export function applyStateLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: Pick<StateBoundaryConfig, 'lineLayerId' | 'lineColor' | 'lineWidth'>
): void {
  if (!map?.getLayer?.(config.lineLayerId)) return;
  map.setPaintProperty?.(config.lineLayerId, 'line-color', config.lineColor);
  map.setPaintProperty?.(config.lineLayerId, 'line-width', config.lineWidth);
  map.setPaintProperty?.(config.lineLayerId, 'line-opacity', 1);
}

export function removeStateBoundaries(
  map: BoundaryMapLike | null | undefined,
  config: Pick<StateBoundaryConfig, 'sourceId' | 'lineLayerId'>
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.lineLayerId)) map.removeLayer?.(config.lineLayerId);
    if (map.getSource?.(config.sourceId)) map.removeSource?.(config.sourceId);
  } catch {
    /* map torn down */
  }
}

export function addStateBoundaries(
  map: BoundaryMapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  config: StateBoundaryConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const lines = polygonsToBoundaryLines(states);
  if (!isBoundaryMapReady(map)) return lines;

  map!.addSource?.(config.sourceId, {
    type: 'geojson',
    data: lines,
    ...ADMIN_STATE_GEOJSON_SOURCE_OPTIONS,
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
        'line-opacity': 1,
      },
    },
    before
  );

  return lines;
}

export function refreshStateBoundaries(
  map: BoundaryMapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  sourceId: string
): GeoJSON.FeatureCollection<GeoJSON.LineString> | null {
  const lines = polygonsToBoundaryLines(states);
  const source = map?.getSource?.(sourceId);
  source?.setData?.(lines);
  return lines;
}
