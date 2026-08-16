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

export function datasetFillLayerId(dataset: string): string {
  return `gk-dataset-${dataset}-fill`;
}

export function isGkDatasetOutlineLayerId(id: string, choroplethDataset?: string): boolean {
  if (!id.startsWith('gk-dataset-')) return false;
  if (!id.endsWith('-line') && !id.endsWith('-lines')) return false;
  if (choroplethDataset && id === `gk-dataset-${choroplethDataset}-line`) return false;
  return true;
}

/** Stack gk-dataset outline line layers above a choropleth fill layer. */
export function stackGkOutlineLayersAboveDatasetFill(
  map: MapWithStyle | null | undefined,
  fillLayerId: string
): void {
  if (!map?.getLayer?.(fillLayerId)) return;
  const choroplethDataset = fillLayerId.startsWith('gk-dataset-') && fillLayerId.endsWith('-fill')
    ? fillLayerId.slice('gk-dataset-'.length, -'-fill'.length)
    : undefined;
  const outlineIds = [
    ...listLayerIdsByPrefix(map, 'gk-dataset-').filter((id) =>
      isGkDatasetOutlineLayerId(id, choroplethDataset)
    ),
  ];
  if (!outlineIds.length) return;
  stackLayersAboveAnchor(map, outlineIds, fillLayerId);
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
