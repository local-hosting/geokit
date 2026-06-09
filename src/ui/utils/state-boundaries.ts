/**
 * US state outline layers — `/us/state/**` CDN namespace.
 */

import {
  addAdminOutlineLayer,
  applyAdminOutlineLinePaint,
  ADMIN_STATE_OUTLINE_SOURCE_OPTIONS,
  refreshAdminOutlineData,
  removeAdminOutlineLayer,
  type AdminOutlineLayerConfig,
} from './admin-outline-layer';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type StateBoundaryConfig = AdminOutlineLayerConfig;

export function applyStateLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: StateBoundaryConfig
): void {
  applyAdminOutlineLinePaint(map, config);
}

export function removeStateBoundaries(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    StateBoundaryConfig,
    'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'
  >
): void {
  removeAdminOutlineLayer(map, config);
}

export function addStateBoundaries(
  map: BoundaryMapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  config: StateBoundaryConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return states;
  return addAdminOutlineLayer(
    map!,
    states,
    {
      ...config,
      polygonSourceOptions: config.polygonSourceOptions ?? ADMIN_STATE_OUTLINE_SOURCE_OPTIONS,
      lineMinzoom: config.lineMinzoom ?? 2,
    },
    beforeLayerId
  );
}

export function refreshStateBoundaries(
  map: BoundaryMapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  config: Pick<StateBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
): GeoJSON.FeatureCollection | null {
  return refreshAdminOutlineData(map, states, config);
}
