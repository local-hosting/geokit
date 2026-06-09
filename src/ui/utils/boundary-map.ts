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

const DEFAULT_BASEMAP_BORDER_LAYER_IDS = [
  'Other border',
  'Other border dash',
  'Country border',
  'Disputed border',
] as const;

/** Hide default basemap borders so custom outlines read clearly. */
export function suppressBasemapBorders(
  map: BoundaryMapLike | null | undefined,
  layerIds: readonly string[] = DEFAULT_BASEMAP_BORDER_LAYER_IDS
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
