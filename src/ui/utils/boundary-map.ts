/** Shared MapLibre helpers for boundary outline layers. */

export type BoundaryMapLike = {
  getStyle?: () => { sources?: unknown; layers?: Array<{ id?: string }> } | null;
  getLayer?: (id: string) => unknown;
  getSource?: (id: string) => { setData?: (data: GeoJSON.FeatureCollection) => void } | undefined;
  addSource?: (id: string, spec: Record<string, unknown>) => void;
  addLayer?: (layer: Record<string, unknown>, before?: string) => void;
  removeLayer?: (id: string) => void;
  removeSource?: (id: string) => void;
  setPaintProperty?: (layer: string, prop: string, value: unknown) => void;
  setLayoutProperty?: (layer: string, prop: string, value: unknown) => void;
  setLayerZoomRange?: (layerId: string, minZoom: number, maxZoom: number) => void;
};

export function isBoundaryMapReady(map: BoundaryMapLike | null | undefined): boolean {
  if (!map) return false;
  try {
    const style = map.getStyle?.();
    if (!style || typeof style !== 'object') return false;
    return 'sources' in style;
  } catch {
    return false;
  }
}

/** MapTiler admin borders — restack above choropleth fills. */
export const BASEMAP_CHOROPLETH_STACK_LAYER_IDS = [
  'Country border',
  'Disputed border',
  'Other border',
  'Other border dash',
] as const;

export const BASEMAP_STATE_BORDER_LAYER_IDS = ['Other border'] as const;

const STATE_BORDER_LINE_WIDTH: unknown[] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2,
  0.65,
  5,
  0.85,
  8,
  1.1,
];

const COUNTY_BORDER_LINE_WIDTH = 0.45;

export const BASEMAP_COUNTY_BORDER_LAYER_IDS = ['Other border dash'] as const;

function setBasemapLayerZoomRange(
  map: BoundaryMapLike,
  layerId: string,
  minZoom: number,
  maxZoom: number
): void {
  if (!map.getLayer?.(layerId) || !map.setLayerZoomRange) return;
  try {
    map.setLayerZoomRange(layerId, minZoom, maxZoom);
  } catch {
    /* style may not expose zoom range */
  }
}

/** Show MapTiler admin borders — smooth vector tiles, not CDN geojson-vt. */
export function restoreBasemapAdminBorders(
  map: BoundaryMapLike | null | undefined,
  options?: { stateLineColor?: string; countyLineColor?: string }
): void {
  if (!map) return;
  for (const layerId of BASEMAP_CHOROPLETH_STACK_LAYER_IDS) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setLayoutProperty?.(layerId, 'visibility', 'visible');
    } catch {
      /* style may not expose layout on this layer */
    }
  }
  if (options?.stateLineColor) {
    for (const layerId of ['Other border', 'Other border dash'] as const) {
      if (!map.getLayer?.(layerId)) continue;
      try {
        map.setPaintProperty?.(layerId, 'line-color', options.stateLineColor);
      } catch {
        /* style may not expose paint on this layer */
      }
    }
  }
  if (options?.countyLineColor) {
    for (const layerId of BASEMAP_COUNTY_BORDER_LAYER_IDS) {
      if (!map.getLayer?.(layerId)) continue;
      try {
        map.setPaintProperty?.(layerId, 'line-color', options.countyLineColor);
      } catch {
        /* style may not expose paint on this layer */
      }
    }
  }
}

/** State borders from national zoom (MapTiler style default minzoom is 5). */
export function extendBasemapStateBorderZoom(
  map: BoundaryMapLike | null | undefined,
  minZoom = 2,
  maxZoom = 8
): void {
  if (!map) return;
  for (const layerId of BASEMAP_STATE_BORDER_LAYER_IDS) {
    setBasemapLayerZoomRange(map, layerId, minZoom, maxZoom);
  }
}

/** County borders when zoomed in (MapTiler style default minzoom is 8). */
export function extendBasemapCountyBorderZoom(
  map: BoundaryMapLike | null | undefined,
  minZoom = 7,
  maxZoom = 14
): void {
  if (!map) return;
  for (const layerId of BASEMAP_COUNTY_BORDER_LAYER_IDS) {
    setBasemapLayerZoomRange(map, layerId, minZoom, maxZoom);
  }
}

export function applyBasemapStateOutline(
  map: BoundaryMapLike | null | undefined,
  lineColor: string
): void {
  restoreBasemapAdminBorders(map, { stateLineColor: lineColor });
  extendBasemapStateBorderZoom(map);
  for (const layerId of BASEMAP_STATE_BORDER_LAYER_IDS) {
    if (!map?.getLayer?.(layerId)) continue;
    map.setPaintProperty?.(layerId, 'line-width', STATE_BORDER_LINE_WIDTH);
  }
}

export function applyBasemapCountyOutline(
  map: BoundaryMapLike | null | undefined,
  lineColor: string,
  minZoom = 7
): void {
  restoreBasemapAdminBorders(map, { countyLineColor: lineColor });
  extendBasemapCountyBorderZoom(map, minZoom);
  for (const layerId of BASEMAP_COUNTY_BORDER_LAYER_IDS) {
    if (!map?.getLayer?.(layerId)) continue;
    map.setPaintProperty?.(layerId, 'line-width', COUNTY_BORDER_LINE_WIDTH);
  }
}

/** Hide default basemap borders so custom CDN outlines read clearly. */
export function suppressBasemapBorders(
  map: BoundaryMapLike | null | undefined,
  layerIds: readonly string[] = BASEMAP_CHOROPLETH_STACK_LAYER_IDS
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

const LEGACY_ADMIN_OUTLINE_LINE_LAYER_IDS = [
  'cdn-state-lines',
  'cdn-county-lines',
  'cdn-city-lines',
] as const;

/** True when the style still has a CDN admin outline line layer (gk-layer or legacy). */
export function isAdminOutlineLineLayerId(id: string): boolean {
  if ((LEGACY_ADMIN_OUTLINE_LINE_LAYER_IDS as readonly string[]).includes(id)) {
    return true;
  }
  return id.startsWith('gk-dataset-') && id.endsWith('-line');
}

export function hasAdminOutlineLineLayers(map: BoundaryMapLike | null | undefined): boolean {
  const layers = map?.getStyle?.()?.layers;
  if (!layers) return false;
  return layers.some((layer) => {
    const id = layer.id;
    return typeof id === 'string' && isAdminOutlineLineLayerId(id);
  });
}

export function assertBoundaryLayerOrder(
  map: BoundaryMapLike | null | undefined,
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
