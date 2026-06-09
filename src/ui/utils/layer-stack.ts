/**
 * MapLibre layer z-order helpers (style-order introspection and stacking).
 */

type MapWithStyle = {
  getStyle?: () => { layers?: Array<{ id?: string }> };
  getLayer?: (id: string) => unknown;
  moveLayer?: (layerId: string, beforeId?: string) => void;
};

/** Layer ids whose id starts with prefix (style order). */
export function listLayerIdsByPrefix(
  map: MapWithStyle | null | undefined,
  prefix: string
): string[] {
  try {
    const layers = map?.getStyle?.()?.layers;
    if (!layers) return [];
    return layers
      .map((layer) => layer.id)
      .filter((id): id is string => typeof id === 'string' && id.startsWith(prefix));
  } catch {
    return [];
  }
}

/**
 * Move layers to sit directly above anchorLayerId (below the next overlay layer).
 */
export function stackLayersAboveAnchor(
  map: MapWithStyle | null | undefined,
  layerIds: readonly string[],
  anchorLayerId: string
): void {
  if (!map || !layerIds.length || !map.getLayer?.(anchorLayerId)) return;

  try {
    const layers = map.getStyle?.()?.layers;
    if (!layers) return;

    const anchorIndex = layers.findIndex((layer) => layer.id === anchorLayerId);
    if (anchorIndex < 0) return;

    const moving = new Set(layerIds);
    let insertBefore: string | undefined;
    for (let i = anchorIndex + 1; i < layers.length; i += 1) {
      const id = layers[i]?.id;
      if (!id || moving.has(id)) continue;
      insertBefore = id;
      break;
    }

    for (const layerId of layerIds) {
      if (!map.getLayer?.(layerId)) continue;
      if (insertBefore && map.getLayer(insertBefore)) {
        map.moveLayer?.(layerId, insertBefore);
      } else {
        map.moveLayer?.(layerId);
      }
    }
  } catch {
    /* map torn down */
  }
}
