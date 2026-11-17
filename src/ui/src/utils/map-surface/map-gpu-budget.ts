/**
 * Map GPU / memory budget helpers.
 * Cap framebuffer DPR, lean create options, and soft-pause render when covered/hidden.
 */

/** Cap canvas backing-store DPR (Retina 2–3× otherwise multiplies GPU memory). */
export const MAX_MAP_PIXEL_RATIO = 1.5;

/** Bound in-memory tile cache (MapLibre/Mapbox; null = dynamic/unbounded). */
export const DEFAULT_MAP_MAX_TILE_CACHE_SIZE = 50;

export type MapGpuCreateOptions = {
  antialias: false;
  preserveDrawingBuffer: false;
  fadeDuration: 0;
  maxTileCacheSize: number;
  crossSourceCollisions: false;
  localIdeographFontFamily: false;
  pixelRatio: number;
};

export type MapGpuPauseTarget = {
  _render?: (...args: unknown[]) => unknown;
  triggerRepaint?: (...args: unknown[]) => unknown;
  stop?: (...args: unknown[]) => unknown;
};

type PauseSlot = {
  depth: number;
  render?: MapGpuPauseTarget['_render'];
  triggerRepaint?: MapGpuPauseTarget['triggerRepaint'];
};

const pauseSlots = new WeakMap<MapGpuPauseTarget, PauseSlot>();

/** Clamp devicePixelRatio for MapLibre/Mapbox setPixelRatio / create options. */
export function resolveMapPixelRatio(devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, MAX_MAP_PIXEL_RATIO);
}

/** Shared lean Map() options — less MSAA/tile/glyph work and a capped pixel ratio. */
export function mapGpuCreateOptions(devicePixelRatio?: number): MapGpuCreateOptions {
  const dpr =
    devicePixelRatio ??
    (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  return {
    antialias: false,
    preserveDrawingBuffer: false,
    fadeDuration: 0,
    maxTileCacheSize: DEFAULT_MAP_MAX_TILE_CACHE_SIZE,
    crossSourceCollisions: false,
    localIdeographFontFamily: false,
    pixelRatio: resolveMapPixelRatio(dpr),
  };
}

/**
 * Soft-pause GPU render without destroying the WebGL context.
 * Refcounted so tab-hidden + covered-overlay can nest; restores on final resume.
 */
export function setMapGpuPaused(map: MapGpuPauseTarget | null | undefined, paused: boolean): void {
  if (!map) return;

  if (paused) {
    let slot = pauseSlots.get(map);
    if (!slot) {
      slot = {
        depth: 0,
        render: typeof map._render === 'function' ? map._render.bind(map) : undefined,
        triggerRepaint:
          typeof map.triggerRepaint === 'function' ? map.triggerRepaint.bind(map) : undefined,
      };
      pauseSlots.set(map, slot);
      if (slot.render) {
        map._render = () => undefined;
      }
      if (slot.triggerRepaint) {
        map.triggerRepaint = () => undefined;
      }
    }
    slot.depth += 1;
    if (typeof map.stop === 'function') {
      try {
        map.stop();
      } catch {
        /* mid-teardown */
      }
    }
    return;
  }

  const slot = pauseSlots.get(map);
  if (!slot) return;
  slot.depth -= 1;
  if (slot.depth > 0) return;
  if (slot.render) map._render = slot.render;
  if (slot.triggerRepaint) map.triggerRepaint = slot.triggerRepaint;
  pauseSlots.delete(map);
  if (typeof map.triggerRepaint === 'function') {
    try {
      map.triggerRepaint();
    } catch {
      /* mid-teardown */
    }
  }
}

/** Pause map GPU while the browser tab is hidden; returns unbind. */
export function bindMapDocumentVisibilityGpu(map: MapGpuPauseTarget): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const sync = () => {
    setMapGpuPaused(map, document.hidden);
  };
  sync();
  document.addEventListener('visibilitychange', sync);
  return () => {
    document.removeEventListener('visibilitychange', sync);
    setMapGpuPaused(map, false);
  };
}
