/**
 * MapLibre layer z-order helpers (style-order introspection and stacking).
 */

export type StyleLayerLike = { id?: string; type?: string };

type MapWithStyle = {
  getStyle?: () => { layers?: StyleLayerLike[] };
  getLayer?: (id: string) => unknown;
  moveLayer?: (layerId: string, beforeId?: string) => void;
};

export type FindInsertBeforeLayerOptions = {
  skipLayer?: (layer: StyleLayerLike) => boolean;
  matchLayer: (layer: StyleLayerLike) => boolean;
};

export function findInsertBeforeLayer(
  map: MapWithStyle | null | undefined,
  options: FindInsertBeforeLayerOptions
): string | undefined {
  try {
    const layers = map?.getStyle?.()?.layers;
    if (!layers) return undefined;
    for (const layer of layers) {
      if (options.skipLayer?.(layer)) continue;
      if (options.matchLayer(layer)) {
        const id = layer.id;
        return typeof id === 'string' && id.length > 0 ? id : undefined;
      }
    }
  } catch {
    /* map torn down */
  }
  return undefined;
}

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

export const GK_DATASET_DMA_FILL_LAYER_ID = 'gk-dataset-dma-fill';

export function isGkDatasetOutlineLayerId(id: string): boolean {
  return (
    id.startsWith('gk-dataset-') &&
    (id.endsWith('-line') || id.endsWith('-lines')) &&
    id !== GK_DATASET_DMA_FILL_LAYER_ID &&
    id !== 'gk-dataset-dma-line'
  );
}

/** Stack CDN admin line layers above DMA choropleth fill. */
export function stackGkOutlineLayersAboveDmaFill(map: MapWithStyle | null | undefined): void {
  if (!map?.getLayer?.(GK_DATASET_DMA_FILL_LAYER_ID)) return;
  const outlineIds = [
    ...listLayerIdsByPrefix(map, 'gk-dataset-').filter(isGkDatasetOutlineLayerId),
    ...['cdn-city-lines', 'cdn-state-lines', 'cdn-county-lines'].filter((id) => map.getLayer?.(id)),
  ];
  if (!outlineIds.length) return;
  stackLayersAboveAnchor(map, outlineIds, GK_DATASET_DMA_FILL_LAYER_ID);
}

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
