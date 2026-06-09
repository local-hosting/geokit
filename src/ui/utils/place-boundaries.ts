/**
 * Place / city outline layers — `/us/place/{state}/**` CDN namespace.
 */

import {
  addAdminOutlineLayer,
  applyAdminOutlineLinePaint,
  refreshAdminOutlineData,
  removeAdminOutlineLayer,
  type AdminOutlineLayerConfig,
} from './admin-outline-layer';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type PlaceBoundaryConfig = AdminOutlineLayerConfig;

export function removePlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    PlaceBoundaryConfig,
    'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'
  >
): void {
  removeAdminOutlineLayer(map, config);
}

export function setPlaceLineOpacity(
  map: BoundaryMapLike | null | undefined,
  lineLayerId: string,
  opacity: number
): void {
  if (!map?.getLayer?.(lineLayerId)) return;
  map.setPaintProperty?.(lineLayerId, 'line-opacity', opacity <= 0 ? 0 : 1);
}

export function refreshPlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: Pick<PlaceBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
): GeoJSON.FeatureCollection {
  const refreshed = refreshAdminOutlineData(map, cities, config);
  return refreshed ?? cities;
}

export function ensurePlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: PlaceBoundaryConfig,
  beforeLayerId?: string,
  lineOpacity = 1
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return cities;

  if (!map!.getSource?.(config.polygonSourceId)) {
    addAdminOutlineLayer(map!, cities, config, beforeLayerId);
    setPlaceLineOpacity(map, config.lineLayerId, lineOpacity);
    return cities;
  }

  refreshPlaceBoundaries(map, cities, config);
  setPlaceLineOpacity(map, config.lineLayerId, lineOpacity);
  return cities;
}

export function applyPlaceLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: PlaceBoundaryConfig
): void {
  applyAdminOutlineLinePaint(map, config);
}
