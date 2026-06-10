/**
 * Map terrain and 3D buildings (Single Responsibility: setup/cleanup terrain and buildings by zoom)
 */

import { debug } from '../../../utils/logger';
import { getProviderConfig } from '../../../providers/registry';
import type { MapInstance } from '../../../providers/types';

export interface MapTerrainContext {
  getAttribute(name: string): string | null;
  map: MapInstance | null;
}

const TERRAIN_SOURCE_ID = 'gk-terrain-dem';
const BUILDINGS_LAYER_ID = 'gk-3d-buildings';
const HILLSHADE_SOURCE_ID = 'gk-hillshade';
const HILLSHADE_LAYER_ID = 'gk-hillshade-layer';

type RasterDemSourceSpec = {
  type: 'raster-dem';
  url?: string;
  tiles?: string[];
  tileSize: number;
};

type RasterSourceSpec = {
  type: 'raster';
  url?: string;
  tiles?: string[];
  tileSize: number;
};

/** When transformRequest is set (e.g. host dev proxy), use tile templates so DEM tiles are rewritten. */
function mapTilerTileTemplate(
  path: string,
  apiKey: string,
  extension: 'webp' | 'png'
): string | null {
  const transformRequest = getProviderConfig('maptiler')?.transformRequest;
  if (typeof transformRequest !== 'function') return null;
  return transformRequest(
    `https://api.maptiler.com/tiles/${path}/{z}/{x}/{y}.${extension}?key=${apiKey}`,
    'Tile'
  ).url;
}

/** Build raster-dem source for MapTiler terrain or MapLibre demo tiles. */
export function buildTerrainDemSource(options: {
  provider: string | null;
  apiKey: string | null;
  explicitUrl?: string | null;
}): RasterDemSourceSpec {
  const { provider, apiKey, explicitUrl } = options;

  if (provider === 'maptiler' && apiKey) {
    const proxiedTiles = mapTilerTileTemplate('terrain-rgb-v2', apiKey, 'webp');
    if (proxiedTiles) {
      return { type: 'raster-dem', tiles: [proxiedTiles], tileSize: 256 };
    }
    const url =
      explicitUrl || `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`;
    return { type: 'raster-dem', url, tileSize: 256 };
  }

  if (explicitUrl) {
    return { type: 'raster-dem', url: explicitUrl, tileSize: 256 };
  }

  return {
    type: 'raster-dem',
    url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
    tileSize: 256,
  };
}

/** Build raster source for MapTiler hand-drawn hillshade. */
export function buildHillshadeRasterSource(apiKey: string, fallbackUrl: string): RasterSourceSpec {
  const proxiedTiles = mapTilerTileTemplate('hand-drawn-hillshade', apiKey, 'png');
  if (proxiedTiles) {
    return { type: 'raster', tiles: [proxiedTiles], tileSize: 256 };
  }
  return { type: 'raster', url: fallbackUrl, tileSize: 256 };
}

/**
 * Create zoom handler that toggles 3D terrain. Caller must attach to map.on('zoom', handler) and store handler for cleanup.
 */
export function createTerrainZoomHandler(ctx: MapTerrainContext): (() => void) | null {
  const minZoomAttr = ctx.getAttribute('terrain-min-zoom');
  if (minZoomAttr === null || minZoomAttr === '') return null;

  const enabledAttr = ctx.getAttribute('terrain-enabled');
  const toggleEnabled = enabledAttr !== null && enabledAttr !== 'false';
  if (!toggleEnabled) return null;

  const minZoom = parseFloat(minZoomAttr);
  if (!Number.isFinite(minZoom) || !ctx.map) return null;

  const map = ctx.map as any;
  if (!map.addSource || !map.setTerrain) return null;

  const explicitUrl = ctx.getAttribute('terrain-source-url')?.trim() || null;
  const provider = ctx.getAttribute('provider');
  const apiKey = ctx.getAttribute('api-key');
  const exaggerationAttr = ctx.getAttribute('terrain-exaggeration');
  const exaggeration = Number.isFinite(parseFloat(String(exaggerationAttr)))
    ? parseFloat(String(exaggerationAttr))
    : 1;

  if (map.getSource?.(TERRAIN_SOURCE_ID)) return null;

  try {
    map.addSource(TERRAIN_SOURCE_ID, buildTerrainDemSource({ provider, apiKey, explicitUrl }));
  } catch (err) {
    debug.warn('[gk-map] Failed to add terrain source', err);
    return null;
  }

  const updateTerrain = (): void => {
    try {
      const enabledAttr = ctx.getAttribute('terrain-enabled');
      const toggleEnabled = enabledAttr !== null && enabledAttr !== 'false';
      const currentZoom = map.getZoom?.() ?? 0;
      const zoomOk = currentZoom >= minZoom;
      if (toggleEnabled && zoomOk) {
        map.setTerrain?.({ source: TERRAIN_SOURCE_ID, exaggeration });
      } else {
        map.setTerrain?.(null);
      }
    } catch {
      // ignore
    }
  };

  map.on('zoom', updateTerrain);
  updateTerrain();
  return updateTerrain;
}

/**
 * Remove terrain listener and disable terrain.
 */
export function cleanupTerrain(map: MapInstance | null, handler: (() => void) | null): void {
  const m = map as any;
  if (handler && m?.off) {
    try {
      m.off('zoom', handler);
    } catch {
      // ignore
    }
  }
  if (m?.setTerrain) {
    try {
      m.setTerrain(null);
    } catch {
      // ignore
    }
  }
}

/**
 * Create zoom handler that toggles 3D buildings. Caller must attach to map.on('zoom', handler) and store handler for cleanup.
 */
export function createBuildingsZoomHandler(ctx: MapTerrainContext): (() => void) | null {
  const minZoomAttr = ctx.getAttribute('buildings-min-zoom');
  if (minZoomAttr === null || minZoomAttr === '') return null;

  const minZoom = parseFloat(minZoomAttr);
  if (!Number.isFinite(minZoom) || !ctx.map) return null;

  const map = ctx.map as any;
  if (!map.getStyle || !map.setLayoutProperty) return null;

  const updateBuildings = (): void => {
    try {
      const toggleEnabled =
        ctx.getAttribute('buildings-enabled') !== null &&
        ctx.getAttribute('buildings-enabled') !== 'false';
      const currentZoom = map.getZoom?.() ?? 0;
      const zoomOk = currentZoom >= minZoom;
      const shouldShow = toggleEnabled && zoomOk;

      const existingLayer = map.getLayer?.(BUILDINGS_LAYER_ID);

      if (shouldShow && !existingLayer) {
        const style = map.getStyle?.();
        const sources = style?.sources ?? {};
        let buildingSource: string | null = null;
        let buildingSourceLayer: string | null = null;

        for (const [sourceId, source] of Object.entries(sources)) {
          if (
            sourceId.includes('building') ||
            sourceId === 'openmaptiles' ||
            sourceId === 'maptiler_planet'
          ) {
            buildingSource = sourceId;
            if ((source as { type?: string }).type === 'vector') {
              buildingSourceLayer = 'building';
            }
            break;
          }
        }

        if (!buildingSource) {
          for (const sourceId of Object.keys(sources)) {
            if (
              sourceId === 'composite' ||
              sourceId === 'openmaptiles' ||
              sourceId.includes('maptiler')
            ) {
              buildingSource = sourceId;
              buildingSourceLayer = 'building';
              break;
            }
          }
        }

        if (buildingSource) {
          try {
            const style = map.getStyle?.();
            const layers = (style?.layers ?? []) as Array<{ id: string; type?: string }>;
            let beforeLayerId: string | undefined;
            for (const layer of layers) {
              const t = layer.type ?? '';
              if (t === 'circle' || t === 'symbol') {
                beforeLayerId = layer.id;
                break;
              }
            }
            const layerSpec = {
              id: BUILDINGS_LAYER_ID,
              type: 'fill-extrusion',
              source: buildingSource,
              ...(buildingSourceLayer && { 'source-layer': buildingSourceLayer }),
              minzoom: minZoom,
              paint: {
                'fill-extrusion-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'height'],
                  0,
                  '#d4d4d4',
                  50,
                  '#a3a3a3',
                  100,
                  '#737373',
                ],
                'fill-extrusion-height': [
                  'coalesce',
                  ['get', 'height'],
                  ['get', 'render_height'],
                  10,
                ],
                'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                'fill-extrusion-opacity': 0.7,
              },
            };
            if (beforeLayerId) {
              map.addLayer(layerSpec as any, beforeLayerId);
            } else {
              map.addLayer(layerSpec as any);
            }
          } catch {
            // Layer add failed
          }
        }
      } else if (!shouldShow && existingLayer) {
        try {
          map.removeLayer(BUILDINGS_LAYER_ID);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  };

  map.on('zoom', updateBuildings);
  updateBuildings();
  return updateBuildings;
}

/**
 * Remove buildings listener and layer.
 */
export function cleanup3DBuildings(map: MapInstance | null, handler: (() => void) | null): void {
  const m = map as any;
  if (!m) return;

  if (m.off && handler) {
    try {
      m.off('zoom', handler);
    } catch {
      // ignore
    }
  }

  try {
    if (typeof m.getLayer === 'function' && m.getLayer(BUILDINGS_LAYER_ID)) {
      m.removeLayer(BUILDINGS_LAYER_ID);
    }
  } catch {
    // ignore
  }
}

/**
 * Add MapTiler hand-drawn hillshade as a raster overlay (available up to zoom 12).
 * Returns an update function the caller can invoke when the enabled attribute changes.
 */
export function setupHillshade(ctx: MapTerrainContext): (() => void) | null {
  if (!ctx.map) return null;

  const map = ctx.map as any;
  if (!map.addSource || !map.addLayer) return null;

  const provider = ctx.getAttribute('provider');
  const apiKey = ctx.getAttribute('api-key');
  const sourceUrl =
    provider === 'maptiler' && apiKey
      ? `https://api.maptiler.com/tiles/hand-drawn-hillshade/tiles.json?key=${apiKey}`
      : null;

  if (!sourceUrl || !apiKey) {
    debug.warn('[gk-map] Hillshade requires maptiler provider with an api-key');
    return null;
  }

  const hillshadeApiKey = apiKey;
  const opacityAttr = ctx.getAttribute('hillshade-opacity');
  const opacity = Number.isFinite(parseFloat(String(opacityAttr)))
    ? Math.min(1, Math.max(0, parseFloat(String(opacityAttr))))
    : 0.3;

  const updateHillshade = (): void => {
    try {
      const enabled =
        ctx.getAttribute('hillshade-enabled') !== null &&
        ctx.getAttribute('hillshade-enabled') !== 'false';

      const hasSource = !!map.getSource?.(HILLSHADE_SOURCE_ID);
      const hasLayer = !!map.getLayer?.(HILLSHADE_LAYER_ID);

      debug.log('[gk-map] hillshade update', { enabled, hasSource, hasLayer, sourceUrl, opacity });

      if (enabled && !hasSource) {
        map.addSource(HILLSHADE_SOURCE_ID, buildHillshadeRasterSource(hillshadeApiKey, sourceUrl));
        debug.log('[gk-map] hillshade: source added');
      }

      if (enabled && !hasLayer) {
        const style = map.getStyle?.();
        const layers = (style?.layers ?? []) as Array<{ id: string; type?: string }>;
        let beforeLayerId: string | undefined;
        for (const layer of layers) {
          const t = layer.type ?? '';
          if (t === 'circle' || t === 'symbol' || t === 'line' || t === 'fill') {
            beforeLayerId = layer.id;
            break;
          }
        }

        const layerSpec: Record<string, unknown> = {
          id: HILLSHADE_LAYER_ID,
          type: 'raster',
          source: HILLSHADE_SOURCE_ID,
          paint: { 'raster-opacity': opacity },
        };

        if (beforeLayerId) {
          map.addLayer(layerSpec, beforeLayerId);
          debug.log('[gk-map] hillshade: layer added before', beforeLayerId);
        } else {
          map.addLayer(layerSpec);
          debug.log('[gk-map] hillshade: layer added (top)');
        }
      } else if (!enabled && hasLayer) {
        map.removeLayer(HILLSHADE_LAYER_ID);
      }

      if (!enabled && hasSource && !hasLayer) {
        map.removeSource(HILLSHADE_SOURCE_ID);
      }
    } catch (err) {
      debug.warn('[gk-map] Hillshade update failed', err);
    }
  };

  updateHillshade();
  return updateHillshade;
}

/**
 * Remove hillshade layer and source.
 */
export function cleanupHillshade(map: MapInstance | null): void {
  const m = map as any;
  if (!m) return;

  try {
    if (typeof m.getLayer === 'function' && m.getLayer(HILLSHADE_LAYER_ID)) {
      m.removeLayer(HILLSHADE_LAYER_ID);
    }
  } catch {
    // ignore
  }

  try {
    if (typeof m.getSource === 'function' && m.getSource(HILLSHADE_SOURCE_ID)) {
      m.removeSource(HILLSHADE_SOURCE_ID);
    }
  } catch {
    // ignore
  }
}
