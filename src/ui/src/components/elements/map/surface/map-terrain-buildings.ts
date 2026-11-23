/**
 * Map terrain and 3D buildings (Single Responsibility: setup/cleanup terrain and buildings by zoom)
 */

import { debug } from '../../../../utils/map-surface/logger';
import { getProviderConfig } from '../../../../providers/registry';
import type { MapInstance } from '../../../../providers/types';
import { healOverlayLayerAbove3dTerrain } from '../../../../utils/paint/shared-point/layer-ids';

export interface MapTerrainContext {
  getAttribute(name: string): string | null;
  map: MapInstance | null;
  /** Fired after each terrain enable/disable application (setTerrain). */
  afterTerrainUpdate?: () => void;
}

const TERRAIN_SOURCE_ID = 'gk-terrain-dem';
const BUILDINGS_LAYER_ID = 'gk-3d-buildings';

export const MAP_3D_BUILDINGS_LAYER_ID = BUILDINGS_LAYER_ID;

type StyleLayerRef = { id: string; type?: string; source?: string };
type StyleSourceRef = { type?: string };

/** Prefer inserting extrusions under app GeoJSON overlays (places, mesh lines). */
export function findBuildingsInsertBeforeLayer(
  layers: StyleLayerRef[],
  sources: Record<string, StyleSourceRef>,
): string | undefined {
  for (const layer of layers) {
    const t = layer.type ?? '';
    if (t !== 'circle' && t !== 'symbol' && t !== 'line') continue;
    const src = layer.source ? sources[layer.source] : undefined;
    if (src?.type === 'geojson') return layer.id;
  }
  for (const layer of layers) {
    const t = layer.type ?? '';
    if (t === 'circle' || t === 'symbol') return layer.id;
  }
  return undefined;
}

/**
 * After 3D terrain or buildings mount, keep GeoJSON venue layers on top and
 * disable depth occlusion (terrain alone does not add `gk-3d-buildings`).
 */
export function ensureGeoJsonOverlaysAbove3dBuildings(map: MapInstance | null | undefined): void {
  const m = map as {
    getStyle?: () => { sources?: Record<string, StyleSourceRef>; layers?: StyleLayerRef[] };
    getLayer?: (id: string) => unknown;
    getTerrain?: () => unknown;
    moveLayer?: (id: string) => void;
    setSlot?: (id: string, slot?: string | null) => void;
    setPaintProperty?: (id: string, k: string, v: unknown) => void;
  } | null;
  if (!m?.getStyle || !m.moveLayer) return;
  const terrainActive = Boolean(m.getTerrain?.());
  const buildingsActive = Boolean(m.getLayer?.(BUILDINGS_LAYER_ID));
  if (!terrainActive && !buildingsActive) return;

  const style = m.getStyle();
  const sources = style?.sources ?? {};
  const layers = style?.layers ?? [];
  for (const layer of layers) {
    const src = layer.source ? sources[layer.source] : undefined;
    if (src?.type !== 'geojson') continue;
    const t = layer.type ?? '';
    if (t !== 'circle' && t !== 'symbol' && t !== 'line') continue;
    if (!m.getLayer(layer.id)) continue;
    try {
      healOverlayLayerAbove3dTerrain(m as never, layer.id, t);
      if (!m.setSlot) {
        m.moveLayer(layer.id);
      }
    } catch {
      /* concurrent style mutation */
    }
  }
}
const HILLSHADE_SOURCE_ID = 'gk-hillshade';
const HILLSHADE_LAYER_ID = 'gk-hillshade-layer';
/** Many vector-tile buildings omit `height`; `interpolate` rejects null input. */
const BUILDING_HEIGHT_EXPRESSION = [
  'to-number',
  ['coalesce', ['get', 'height'], ['get', 'render_height'], 10],
  10,
];

type RasterDemSourceSpec = {
  type: 'raster-dem';
  url?: string;
  tiles?: string[];
  tileSize: number;
  minzoom?: number;
  maxzoom?: number;
};

type RasterSourceSpec = {
  type: 'raster';
  url?: string;
  tiles?: string[];
  tileSize: number;
  minzoom?: number;
  maxzoom?: number;
};

/** MapTiler hand-drawn-hillshade tiles.json maxzoom (requests above this return 400). */
export const MAPTILER_HAND_DRAWN_HILLSHADE_MAX_ZOOM = 9;

/** MapTiler terrain-rgb-v2 tiles.json maxzoom. */
export const MAPTILER_TERRAIN_RGB_MAX_ZOOM = 14;

/** Basemap vector layers painted for relief (Corio/Mapbox outdoors) — not `gk-hillshade-layer`. */
const BASEMAP_TERRAIN_CHROME_SOURCE_LAYERS = new Set(['contour', 'hillshade']);

/** True for style contour / hillshade layers the terrain toggle should show/hide. */
export function isBasemapTerrainChromeLayer(layer: {
  id?: string;
  'source-layer'?: string;
}): boolean {
  const id = layer.id ?? '';
  if (id.startsWith('gk-')) return false;
  const sourceLayer = layer['source-layer'];
  if (sourceLayer && BASEMAP_TERRAIN_CHROME_SOURCE_LAYERS.has(sourceLayer)) return true;
  return id === 'hillshade' || /^contour([-_]|$)/i.test(id);
}

/**
 * Show/hide basemap contour lines + style hillshade (independent of DEM `setTerrain`).
 * Mapbox Corio keeps these layers visible even after `setTerrain(null)`.
 */
export function setBasemapTerrainChromeVisible(
  map: MapInstance | null | Record<string, unknown>,
  visible: boolean
): void {
  const m = map as {
    getStyle?: () => { layers?: Array<{ id: string; 'source-layer'?: string }> };
    getLayoutProperty?: (id: string, key: string) => unknown;
    setLayoutProperty?: (id: string, key: string, value: string) => void;
  } | null;
  if (!m?.getStyle || !m.setLayoutProperty) return;

  const visibility = visible ? 'visible' : 'none';
  const layers = m.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (!isBasemapTerrainChromeLayer(layer)) continue;
    try {
      const current = m.getLayoutProperty?.(layer.id, 'visibility');
      if (current === visibility) continue;
      m.setLayoutProperty(layer.id, 'visibility', visibility);
    } catch {
      // Layer may have been removed mid-style swap
    }
  }
}

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

/** First raster-dem source id already present in the style (e.g. Corio `mapbox-dem`). */
export function findStyleRasterDemSourceId(map: {
  getStyle?: () => { sources?: Record<string, { type?: string } | undefined> };
}): string | null {
  const sources = map.getStyle?.()?.sources;
  if (!sources) return null;
  for (const [id, source] of Object.entries(sources)) {
    if (source?.type === 'raster-dem') return id;
  }
  return null;
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
      return {
        type: 'raster-dem',
        tiles: [proxiedTiles],
        tileSize: 256,
        minzoom: 0,
        maxzoom: MAPTILER_TERRAIN_RGB_MAX_ZOOM,
      };
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

function clearMapTerrain(map: {
  getTerrain?: () => unknown;
  setTerrain?: (terrain: null) => void;
}): void {
  if (!map.setTerrain) return;
  try {
    if (typeof map.getTerrain === 'function' && !map.getTerrain()) return;
    map.setTerrain(null);
  } catch {
    // ignore
  }
}

/** Build raster source for MapTiler hand-drawn hillshade. */
export function buildHillshadeRasterSource(apiKey: string, fallbackUrl: string): RasterSourceSpec {
  const proxiedTiles = mapTilerTileTemplate('hand-drawn-hillshade', apiKey, 'webp');
  if (proxiedTiles) {
    // Inline tile templates skip tiles.json — must cap zoom or MapLibre over-fetches and MapTiler 400s.
    return {
      type: 'raster',
      tiles: [proxiedTiles],
      tileSize: 256,
      minzoom: 0,
      maxzoom: MAPTILER_HAND_DRAWN_HILLSHADE_MAX_ZOOM,
    };
  }
  return { type: 'raster', url: fallbackUrl, tileSize: 256 };
}

/**
 * Create zoom handler that toggles 3D terrain. Caller must attach to map.on('zoom', handler) and store handler for cleanup.
 */
export function createTerrainZoomHandler(ctx: MapTerrainContext): (() => void) | null {
  const enabledAttr = ctx.getAttribute('terrain-enabled');
  const toggleEnabled = enabledAttr !== null && enabledAttr !== 'false';
  if (!toggleEnabled) return null;
  if (!ctx.map) return null;

  // Absent terrain-min-zoom → always on when enabled (toggle controls / hosts).
  const minZoomAttr = ctx.getAttribute('terrain-min-zoom');
  const minZoom =
    minZoomAttr === null || minZoomAttr === '' ? 0 : parseFloat(minZoomAttr);
  if (!Number.isFinite(minZoom)) return null;

  const map = ctx.map as any;
  if (!map.setTerrain) return null;

  const explicitUrl = ctx.getAttribute('terrain-source-url')?.trim() || null;
  const provider = ctx.getAttribute('provider');
  const apiKey = ctx.getAttribute('api-key');
  const exaggerationAttr = ctx.getAttribute('terrain-exaggeration');
  const exaggeration = Number.isFinite(parseFloat(String(exaggerationAttr)))
    ? parseFloat(String(exaggerationAttr))
    : 1;

  /** Prefer style DEM on Mapbox; never attach MapLibre demotiles to Mapbox GL. */
  const resolveTerrainSourceId = (): string | null => {
    if (explicitUrl || (provider === 'maptiler' && apiKey)) {
      if (map.getSource?.(TERRAIN_SOURCE_ID)) return TERRAIN_SOURCE_ID;
      if (!map.addSource) return null;
      try {
        map.addSource(TERRAIN_SOURCE_ID, buildTerrainDemSource({ provider, apiKey, explicitUrl }));
        return TERRAIN_SOURCE_ID;
      } catch (err) {
        debug.warn('Failed to add terrain source', err);
        return null;
      }
    }

    const styleDemId = findStyleRasterDemSourceId(map);
    if (styleDemId) return styleDemId;

    if (provider === 'mapbox') {
      // Corio/outdoors embeds mapbox-dem; do not fall back to MapLibre demotiles.
      return null;
    }

    if (map.getSource?.(TERRAIN_SOURCE_ID)) return TERRAIN_SOURCE_ID;
    if (!map.addSource) return null;
    try {
      map.addSource(TERRAIN_SOURCE_ID, buildTerrainDemSource({ provider, apiKey, explicitUrl }));
      return TERRAIN_SOURCE_ID;
    } catch (err) {
      debug.warn('Failed to add terrain source', err);
      return null;
    }
  };

  // Style swaps / full rebuilds drop DEM; zoom/move still call updateTerrain.
  // Mapbox may only toggle contour chrome when style DEM is temporarily missing.
  const initialSourceId = resolveTerrainSourceId();
  if (!initialSourceId && provider !== 'mapbox') return null;

  const updateTerrain = (): void => {
    try {
      const enabledAttr = ctx.getAttribute('terrain-enabled');
      const toggleEnabled = enabledAttr !== null && enabledAttr !== 'false';
      const currentZoom = map.getZoom?.() ?? 0;
      const zoomOk = currentZoom >= minZoom;
      if (toggleEnabled && zoomOk) {
        const sourceId = resolveTerrainSourceId();
        if (sourceId) {
          map.setTerrain?.({ source: sourceId, exaggeration });
        }
        setBasemapTerrainChromeVisible(map, true);
      } else {
        clearMapTerrain(map);
        setBasemapTerrainChromeVisible(map, false);
      }
      const notify = (): void => {
        ensureGeoJsonOverlaysAbove3dBuildings(map);
        ctx.afterTerrainUpdate?.();
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(notify);
      } else {
        notify();
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
  clearMapTerrain(m);
  setBasemapTerrainChromeVisible(map, false);
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
            const layers = (style?.layers ?? []) as StyleLayerRef[];
            const beforeLayerId = findBuildingsInsertBeforeLayer(layers, sources);
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
                  BUILDING_HEIGHT_EXPRESSION,
                  0,
                  '#d4d4d4',
                  50,
                  '#a3a3a3',
                  100,
                  '#737373',
                ],
                'fill-extrusion-height': BUILDING_HEIGHT_EXPRESSION,
                'fill-extrusion-base': ['to-number', ['coalesce', ['get', 'min_height'], 0], 0],
                'fill-extrusion-opacity': 0.7,
              },
            };
            if (beforeLayerId) {
              map.addLayer(layerSpec as any, beforeLayerId);
            } else {
              map.addLayer(layerSpec as any);
            }
            ensureGeoJsonOverlaysAbove3dBuildings(map);
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
 * Add MapTiler hand-drawn hillshade as a raster overlay (available up to zoom 9).
 * Returns an update function the caller can invoke when the enabled attribute changes.
 */
export function setupHillshade(ctx: MapTerrainContext): (() => void) | null {
  if (!ctx.map) return null;

  const hillshadeEnabled =
    ctx.getAttribute('hillshade-enabled') !== null &&
    ctx.getAttribute('hillshade-enabled') !== 'false';
  if (!hillshadeEnabled) return null;

  const map = ctx.map as any;
  if (!map.addSource || !map.addLayer) return null;

  const provider = ctx.getAttribute('provider');
  if (provider !== 'maptiler') {
    return null;
  }
  const apiKey = ctx.getAttribute('api-key');
  if (!apiKey) {
    return null;
  }
  const sourceUrl = `https://api.maptiler.com/tiles/hand-drawn-hillshade/tiles.json?key=${apiKey}`;

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

      debug.log('hillshade update', { enabled, hasSource, hasLayer, sourceUrl, opacity });

      if (enabled && !hasSource) {
        map.addSource(HILLSHADE_SOURCE_ID, buildHillshadeRasterSource(hillshadeApiKey, sourceUrl));
        debug.log('hillshade: source added');
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
          debug.log('hillshade: layer added before', beforeLayerId);
        } else {
          map.addLayer(layerSpec);
          debug.log('hillshade: layer added (top)');
        }
      } else if (!enabled && hasLayer) {
        map.removeLayer(HILLSHADE_LAYER_ID);
      }

      if (!enabled && hasSource && !hasLayer) {
        map.removeSource(HILLSHADE_SOURCE_ID);
      }
    } catch (err) {
      debug.warn('Hillshade update failed', err);
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
