import { isEphemeralGkH3StyleOverlayId } from '../../components/elements/map/style/preserve-custom-style-overlays';

type MapStyleLayer = { id: string; source?: string }

type MapWithStyle = {
  getStyle?: () => { layers?: MapStyleLayer[]; sources?: Record<string, unknown> } | null | undefined
  getLayer?: (id: string) => unknown
  getSource?: (id: string) => unknown
  removeLayer?: (id: string) => void
  removeSource?: (id: string) => void
}

/** Drop orphan `gk-h3` preview layers (e.g. after route remount or GPU pause). */
export function removeEphemeralGkH3LayersFromMap(map: MapWithStyle | null | undefined): void {
  if (!map?.getStyle || !map.removeLayer || !map.removeSource) return
  const style = map.getStyle()
  if (!style) return

  const layers = [...(style.layers ?? [])].reverse()
  const sourceIdsToRemove = new Set<string>()

  for (const layer of layers) {
    if (!isEphemeralGkH3StyleOverlayId(layer.id)) continue
    const source = typeof layer.source === 'string' ? layer.source : ''
    if (source && isEphemeralGkH3StyleOverlayId(source)) sourceIdsToRemove.add(source)
    if (!map.getLayer?.(layer.id)) continue
    try {
      map.removeLayer(layer.id)
    } catch {
      // layer may already be gone during style churn
    }
  }

  for (const sourceId of sourceIdsToRemove) {
    if (!map.getSource?.(sourceId)) continue
    try {
      map.removeSource(sourceId)
    } catch {
      // source still referenced
    }
  }

  for (const sourceId of Object.keys(style.sources ?? {})) {
    if (!isEphemeralGkH3StyleOverlayId(sourceId)) continue
    if (!map.getSource?.(sourceId)) continue
    try {
      map.removeSource(sourceId)
    } catch {
      // best effort
    }
  }
}