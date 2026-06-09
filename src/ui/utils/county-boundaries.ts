/**
 * US county outline layers — `/us/county/**` CDN namespace.
 */

import {
  addAdminOutlineLayer,
  applyAdminOutlineLinePaint,
  ADMIN_COUNTY_OUTLINE_SOURCE_OPTIONS,
  refreshAdminOutlineData,
  removeAdminOutlineLayer,
  type AdminOutlineLayerConfig,
} from './admin-outline-layer';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type CountyBoundaryConfig = AdminOutlineLayerConfig;

export function applyCountyLinePaint(
  map: BoundaryMapLike | null | undefined,
  config: CountyBoundaryConfig
): void {
  applyAdminOutlineLinePaint(map, config);
}

export function removeCountyBoundaries(
  map: BoundaryMapLike | null | undefined,
  config: Pick<
    CountyBoundaryConfig,
    'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'
  >
): void {
  removeAdminOutlineLayer(map, config);
}

export function addCountyBoundaries(
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: CountyBoundaryConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return counties;
  return addAdminOutlineLayer(
    map!,
    counties,
    {
      ...config,
      polygonSourceOptions: config.polygonSourceOptions ?? ADMIN_COUNTY_OUTLINE_SOURCE_OPTIONS,
    },
    beforeLayerId
  );
}

export function refreshCountyBoundaries(
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: Pick<CountyBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
): GeoJSON.FeatureCollection | null {
  return refreshAdminOutlineData(map, counties, config);
}
