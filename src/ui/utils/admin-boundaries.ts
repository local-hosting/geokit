/**
 * Globe admin boundary layers — county/state outline GeoJSON on MapLibre.
 */

import { polygonsToBoundaryLines } from '../../utils/geojson/boundary-lines';
import { ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS } from './geojson-source-options';

export type AdminBoundaryIds = {
  countySourceId: string;
  countyLineLayerId: string;
  stateSourceId: string;
  stateLineLayerId: string;
};

export type AdminBoundaryPaint = {
  countyLineColor: string;
  countyLineWidth: number;
  stateLineColor: string;
  stateLineWidth: number | unknown[];
};

export type AdminBoundaryConfig = AdminBoundaryIds &
  AdminBoundaryPaint & {
    basemapAdminBorderLayerIds?: readonly string[];
  };

function isMapReady(map: MapLike | null | undefined): boolean {
  if (!map) return false;
  try {
    const style = map.getStyle?.();
    if (!style || typeof style !== 'object') return false;
    return 'sources' in style;
  } catch {
    return false;
  }
}

type MapLike = {
  getStyle?: () => { sources?: unknown; layers?: Array<{ id?: string }> } | null;
  getLayer?: (id: string) => unknown;
  getSource?: (id: string) => { setData?: (data: GeoJSON.FeatureCollection) => void } | undefined;
  addSource?: (id: string, spec: Record<string, unknown>) => void;
  addLayer?: (layer: Record<string, unknown>, before?: string) => void;
  removeLayer?: (id: string) => void;
  removeSource?: (id: string) => void;
  setPaintProperty?: (layer: string, prop: string, value: unknown) => void;
  setLayoutProperty?: (layer: string, prop: string, value: unknown) => void;
};

const DEFAULT_BASEMAP_ADMIN_BORDER_LAYER_IDS = [
  'Other border',
  'Other border dash',
  'Country border',
  'Disputed border',
] as const;

/** Hide default basemap admin borders so custom outlines read clearly. */
export function suppressBasemapAdminBorders(
  map: MapLike | null | undefined,
  layerIds: readonly string[] = DEFAULT_BASEMAP_ADMIN_BORDER_LAYER_IDS
): void {
  if (!map) return;
  for (const layerId of layerIds) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setLayoutProperty?.(layerId, 'visibility', 'none');
    } catch {
      /* style may not expose layout on this layer */
    }
  }
}

export function applyAdminStateLinePaint(
  map: MapLike | null | undefined,
  config: Pick<AdminBoundaryConfig, 'stateLineLayerId' | 'stateLineColor' | 'stateLineWidth'>
): void {
  if (!map?.getLayer?.(config.stateLineLayerId)) return;
  map.setPaintProperty?.(config.stateLineLayerId, 'line-color', config.stateLineColor);
  map.setPaintProperty?.(config.stateLineLayerId, 'line-width', config.stateLineWidth);
  map.setPaintProperty?.(config.stateLineLayerId, 'line-opacity', 1);
}

export function removeAdminBoundaries(
  map: MapLike | null | undefined,
  config: AdminBoundaryIds
): void {
  if (!map) return;
  try {
    if (map.getLayer?.(config.stateLineLayerId)) map.removeLayer?.(config.stateLineLayerId);
    if (map.getLayer?.(config.countyLineLayerId)) map.removeLayer?.(config.countyLineLayerId);
    if (map.getSource?.(config.stateSourceId)) map.removeSource?.(config.stateSourceId);
    if (map.getSource?.(config.countySourceId)) map.removeSource?.(config.countySourceId);
  } catch {
    /* map torn down */
  }
}

export function addAdminCountyBoundaries(
  map: MapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: AdminBoundaryConfig,
  beforeLayerId?: string
): void {
  if (!isMapReady(map)) return;

  map!.addSource?.(config.countySourceId, {
    type: 'geojson',
    data: counties,
    ...ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS,
  });

  const before = beforeLayerId && map!.getLayer?.(beforeLayerId) ? beforeLayerId : undefined;

  map!.addLayer?.(
    {
      id: config.countyLineLayerId,
      type: 'line',
      source: config.countySourceId,
      paint: {
        'line-color': config.countyLineColor,
        'line-width': config.countyLineWidth,
        'line-opacity': 1,
      },
    },
    before
  );
}

export function addAdminStateBoundaries(
  map: MapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  config: AdminBoundaryConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const lines = polygonsToBoundaryLines(states);
  if (!isMapReady(map)) return lines;

  map!.addSource?.(config.stateSourceId, {
    type: 'geojson',
    data: lines,
  });

  const before = beforeLayerId && map!.getLayer?.(beforeLayerId) ? beforeLayerId : undefined;

  map!.addLayer?.(
    {
      id: config.stateLineLayerId,
      type: 'line',
      source: config.stateSourceId,
      paint: {
        'line-color': config.stateLineColor,
        'line-width': config.stateLineWidth,
        'line-opacity': 1,
      },
    },
    before
  );

  return lines;
}

export function refreshAdminStateBoundaries(
  map: MapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  stateSourceId: string
): GeoJSON.FeatureCollection<GeoJSON.LineString> | null {
  const lines = polygonsToBoundaryLines(states);
  const source = map?.getSource?.(stateSourceId);
  source?.setData?.(lines);
  return lines;
}

export function assertAdminBoundaryLayerOrder(
  map: MapLike | null | undefined,
  layerIds: readonly string[],
  onUnexpected?: (detail: { order: readonly string[]; indices: number[] }) => void
): void {
  const style = map?.getStyle?.();
  if (!style?.layers) return;

  const indices = layerIds
    .map((id) => style.layers!.findIndex((layer) => layer.id === id))
    .filter((index) => index >= 0);

  if (indices.length < 2) return;

  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i]! <= indices[i - 1]!) {
      onUnexpected?.({ order: layerIds, indices });
      return;
    }
  }
}
