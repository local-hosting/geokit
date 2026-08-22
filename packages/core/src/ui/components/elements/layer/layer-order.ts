/**
 * Layer z-order helpers (Single Responsibility: find insert-before layer ID)
 */

type MapWithStyle = {
  getStyle?: () => { layers?: Array<{ id?: string; type?: string }> };
  getLayer?: (id: string) => unknown;
};

/**
 * Find the first circle layer in the style (for inserting fill/line below points).
 */
export function findFirstCircleLayer(map: MapWithStyle | null): string | undefined {
  if (!map) return undefined;
  try {
    const style = map.getStyle?.();
    if (!style?.layers) return undefined;
    for (const layer of style.layers as Array<{ id?: string; type?: string }>) {
      if (layer.type === 'circle') return layer.id;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Resolve the layer ID to insert before (explicit beforeLayerId or first circle for fill/line).
 */
export function findBeforeLayerId(
  map: MapWithStyle | null,
  options: {
    beforeLayerId?: string;
    layerType?: string;
  }
): string | undefined {
  if (!map) return undefined;

  if (options.beforeLayerId && map.getLayer?.(options.beforeLayerId)) {
    return options.beforeLayerId;
  }

  if (options.layerType === 'fill' || options.layerType === 'line') {
    return findFirstCircleLayer(map);
  }

  return undefined;
}
