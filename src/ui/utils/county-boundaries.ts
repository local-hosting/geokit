/**
 * US county outline layers — `/us/county/**` CDN namespace.
 */

import { polygonsToBoundaryLines } from '../../utils/geojson/boundary-lines';
import { ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS } from './geojson-source-options';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type CountyBoundaryConfig = {
  sourceId: string;
  lineLayerId: string;
  lineColor: string;
  lineWidth: number;
};

export function removeCountyBoundaries(
  map: BoundaryMapLike | null | undefined,
  config: Pick<CountyBoundaryConfig, 'sourceId' | 'lineLayerId'>
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.lineLayerId)) map.removeLayer?.(config.lineLayerId);
    if (map.getSource?.(config.sourceId)) map.removeSource?.(config.sourceId);
  } catch {
    /* map torn down */
  }
}

export function addCountyBoundaries(
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: CountyBoundaryConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const lines = polygonsToBoundaryLines(counties);
  if (!isBoundaryMapReady(map)) return lines;

  map!.addSource?.(config.sourceId, {
    type: 'geojson',
    data: lines,
    ...ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS,
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
