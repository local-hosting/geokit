/**
 * Carry app-owned sources/layers across a basemap `setStyle` so theme swaps
 * do not drop venues, selection badges, hover clones, etc.
 */

export type StyleOverlaySpec = {
  sources?: Record<string, unknown>
  layers?: Array<{ id: string; source?: string; [key: string]: unknown }>
  [key: string]: unknown
}

/**
 * Merge previous custom overlays into the next basemap style.
 * Anything whose id is not already in `nextStyle` is treated as app-owned.
 */
export function preserveCustomStyleOverlays(
  previousStyle: StyleOverlaySpec | null | undefined,
  nextStyle: StyleOverlaySpec,
): StyleOverlaySpec {
  if (!previousStyle) return nextStyle

  const nextSources = { ...(nextStyle.sources ?? {}) }
  const nextSourceIds = new Set(Object.keys(nextSources))
  for (const [id, source] of Object.entries(previousStyle.sources ?? {})) {
    if (!nextSourceIds.has(id)) nextSources[id] = source
  }

  const nextLayers = [...(nextStyle.layers ?? [])]
  const nextLayerIds = new Set(nextLayers.map((layer) => layer.id))
  for (const layer of previousStyle.layers ?? []) {
    if (!nextLayerIds.has(layer.id)) nextLayers.push(layer)
  }

  return {
    ...nextStyle,
    sources: nextSources,
    layers: nextLayers,
  }
}

/** Options bag for MapLibre / MapTiler `setStyle` theme swaps. */
export function mapStyleSwapOptions(): {
  transformStyle: (
    previous: StyleOverlaySpec | undefined,
    next: StyleOverlaySpec,
  ) => StyleOverlaySpec
} {
  return {
    transformStyle: (previous, next) => preserveCustomStyleOverlays(previous, next),
  }
}

/** True when an app overlay source+layer survived a basemap style swap. */
export function mapHasOverlay(
  map:
    | {
        getSource?: (id: string) => unknown
        getLayer?: (id: string) => unknown
      }
    | null
    | undefined,
  sourceId: string | null | undefined,
  layerId: string | null | undefined,
): boolean {
  if (!map || !sourceId || !layerId) return false
  return Boolean(map.getSource?.(sourceId) && map.getLayer?.(layerId))
}
