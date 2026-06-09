/**
 * Tear down geokit / MapTiler terrain and hillshade on a flat map.
 */

export const GEOKIT_TERRAIN_SOURCE_IDS = ['gk-terrain-dem', 'maptiler-terrain'] as const;
export const GEOKIT_HILLSHADE_LAYER_ID = 'gk-hillshade-layer';
export const GEOKIT_HILLSHADE_SOURCE_ID = 'gk-hillshade';

type TerrainMap = {
  setPitch?: (pitch: number) => void;
  setMaxPitch?: (pitch: number) => void;
  easeTo?: (options: { pitch?: number; duration?: number }) => void;
  setTerrain?: (value: null) => void;
  disableTerrain?: () => void;
  isStyleLoaded?: () => boolean;
  getSource?: (id: string) => unknown;
  removeSource?: (id: string) => void;
  getLayer?: (id: string) => unknown;
  removeLayer?: (id: string) => void;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
};

const guardByMap = new WeakMap<object, () => void>();

function styleReadyForTerrainTeardown(map: TerrainMap | null | undefined): boolean {
  if (!map) return false;
  if (typeof map.isStyleLoaded !== 'function') return true;
  return map.isStyleLoaded();
}

/** Keep the map flat (zero pitch, no 3D relief). */
export function flattenMapView(map: unknown): void {
  const m = map as TerrainMap | null | undefined;
  if (!m) return;
  try {
    m.setMaxPitch?.(0);
  } catch {
    /* ignore */
  }
  const pitch = (m as { getPitch?: () => number }).getPitch?.() ?? 0;
  if (pitch > 0.01) {
    try {
      if (typeof m.easeTo === 'function') {
        m.easeTo({ pitch: 0, duration: 0 });
      } else {
        m.setPitch?.(0);
      }
    } catch {
      /* ignore */
    }
  } else {
    try {
      m.setPitch?.(0);
    } catch {
      /* ignore */
    }
  }
}

/** Tear down DEM + hillshade so terrain-rgb tiles are not fetched. */
export function disableMapTerrain(map: unknown): void {
  const m = map as TerrainMap | null | undefined;
  if (!m) return;

  flattenMapView(m);
  if (!styleReadyForTerrainTeardown(m)) return;

  try {
    m.disableTerrain?.();
  } catch {
    /* map torn down */
  }
  try {
    m.setTerrain?.(null);
  } catch {
    /* map torn down */
  }
  try {
    if (m.getLayer?.(GEOKIT_HILLSHADE_LAYER_ID)) m.removeLayer?.(GEOKIT_HILLSHADE_LAYER_ID);
  } catch {
    /* map torn down */
  }
  for (const sourceId of [...GEOKIT_TERRAIN_SOURCE_IDS, GEOKIT_HILLSHADE_SOURCE_ID]) {
    try {
      if (m.getSource?.(sourceId)) m.removeSource?.(sourceId);
    } catch {
      /* source in use or map torn down */
    }
  }
}

type TerrainGkMap = HTMLElement & { getMap?: () => unknown };

/** gk-map attributes only — safe before the map instance finishes style load. */
export function applyMapTerrainOffAttributes(gkMap: TerrainGkMap | null | undefined): void {
  if (!gkMap) return;
  gkMap.removeAttribute('terrain-min-zoom');
  gkMap.removeAttribute('terrain-exaggeration');
  gkMap.setAttribute('terrain-enabled', 'false');
  gkMap.setAttribute('hillshade-enabled', 'false');
  gkMap.setAttribute('max-pitch', '0');
  gkMap.setAttribute('pitch', '0');
}

/** Ensure gk-map attributes and the live map instance keep terrain off. */
export function disableMapTerrainOnElement(gkMap: TerrainGkMap | null | undefined): void {
  applyMapTerrainOffAttributes(gkMap);
  disableMapTerrain(gkMap?.getMap?.());
}

/** Re-apply teardown when MapTiler enables terrain after load/pitch changes. */
export function bindMapTerrainGuard(map: unknown): () => void {
  const m = map as TerrainMap | null | undefined;
  if (!m?.on || !m.off) return () => {};

  const existing = guardByMap.get(m as object);
  existing?.();

  const reapply = () => {
    disableMapTerrain(m);
  };
  const events = ['terrain'] as const;
  for (const event of events) {
    m.on(event, reapply);
  }
  reapply();

  const cleanup = () => {
    for (const event of events) {
      try {
        m.off?.(event, reapply);
      } catch {
        /* map torn down */
      }
    }
    guardByMap.delete(m as object);
  };
  guardByMap.set(m as object, cleanup);
  return cleanup;
}

export function unbindMapTerrainGuard(map: unknown): void {
  const m = map as object | null | undefined;
  if (!m) return;
  guardByMap.get(m)?.();
}
