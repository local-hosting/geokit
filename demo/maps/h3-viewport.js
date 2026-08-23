import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import {
  h3CellsAtPoint,
  h3CellsForViewportBounds,
  h3GridFeatureCollection,
  prioritizeH3CellsNearCenter,
} from '../../packages/core/src/utils/h3/viewport.ts';
import { compactH3CellId } from '../../packages/core/src/utils/h3/cell-id.ts';
import { mapViewportBounds } from '../../packages/core/src/utils/h3/map-viewport.ts';
import { buildOpacityWithHoverExpression } from '../../packages/core/src/ui/utils/feature-state-hover.ts';

const mapElement = document.getElementById('h3-viewport-map');
const resolutionInput = document.getElementById('resolution');
const maxCellsInput = document.getElementById('max-cells');

const SOURCE_ID = 'h3-viewport-grid';
const FILL_LAYER_ID = 'h3-viewport-grid-fill';
const LINE_LAYER_ID = 'h3-viewport-grid-line';
const GRID_LINE_OPACITY = 0.07;
const GRID_HOVER_FILL_OPACITY = 0.05;

/** @type {Set<string>} */
let visibleCellIds = new Set();
let hoveredCellId = null;
let gridDragging = false;
let gridBound = false;
let interactivityBound = false;
let hoverRaf = 0;
/** @type {{ lat: number; lng: number } | null} */
let pendingHoverLngLat = null;

/** @param {string} message @param {unknown} [detail] */
function log(message, detail) {
  if (detail === undefined) {
    console.log(`[gk-h3] ${message}`);
    return;
  }
  console.log(`[gk-h3] ${message}`, detail);
}

function readResolution() {
  const parsed = Number.parseInt(resolutionInput.value, 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(Math.max(parsed, 0), 6);
}

function readMaxCells() {
  const parsed = Number.parseInt(maxCellsInput.value, 10);
  if (!Number.isFinite(parsed)) return 160;
  return Math.min(Math.max(parsed, 8), 400);
}

/** @param {import('maplibre-gl').Map} map */
function clearGridHover(map) {
  if (!hoveredCellId || !map.removeFeatureState) return;
  try {
    if (map.getSource?.(SOURCE_ID)) {
      map.removeFeatureState({ source: SOURCE_ID, id: hoveredCellId });
    }
  } catch {
    // source may be rebuilding
  }
  hoveredCellId = null;
  const canvas = map.getCanvas?.();
  if (canvas) canvas.style.cursor = '';
}

/** @param {import('maplibre-gl').Map} map @param {string | null} cellId */
function setGridHover(map, cellId) {
  if (cellId === hoveredCellId) return;

  if (hoveredCellId) {
    try {
      map.removeFeatureState?.({ source: SOURCE_ID, id: hoveredCellId });
    } catch {
      // ignore
    }
  }

  hoveredCellId = cellId;
  const canvas = map.getCanvas?.();

  if (!cellId || !visibleCellIds.has(cellId)) {
    hoveredCellId = null;
    if (canvas) canvas.style.cursor = '';
    return;
  }

  try {
    map.setFeatureState?.({ source: SOURCE_ID, id: cellId }, { hover: true });
    if (canvas) canvas.style.cursor = 'pointer';
  } catch {
    hoveredCellId = null;
    if (canvas) canvas.style.cursor = '';
  }
}

/** @param {import('maplibre-gl').Map} map */
function resolveHoveredCell(map, lngLat) {
  const resolution = readResolution();
  const [cell] = h3CellsAtPoint(lngLat.lat, lngLat.lng, resolution);
  if (!cell) {
    setGridHover(map, null);
    return;
  }
  const cellId = compactH3CellId(cell);
  setGridHover(map, visibleCellIds.has(cellId) ? cellId : null);
}

/** @param {import('maplibre-gl').Map} map */
function scheduleHoverUpdate(map, lngLat) {
  pendingHoverLngLat = lngLat;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    const point = pendingHoverLngLat;
    pendingHoverLngLat = null;
    if (!point || gridDragging) return;
    resolveHoveredCell(map, point);
  });
}

/** @param {import('maplibre-gl').Map} map */
function bindGridInteractivity(map) {
  if (interactivityBound) return;
  interactivityBound = true;

  map.on('click', (e) => {
    if (gridDragging || !e.lngLat) return;
    const resolution = readResolution();
    const [cell] = h3CellsAtPoint(e.lngLat.lat, e.lngLat.lng, resolution);
    if (!cell) return;
    const cellId = compactH3CellId(cell);
    if (!visibleCellIds.has(cellId)) return;
    log('h3-click', { h3: cellId });
  });

  map.on('mousemove', (e) => {
    if (gridDragging || !e.lngLat) return;
    scheduleHoverUpdate(map, e.lngLat);
  });

  map.on('mouseout', () => {
    pendingHoverLngLat = null;
    clearGridHover(map);
  });
}

/** @param {import('maplibre-gl').Map} map */
function ensureGridLayers(map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'h3',
    });
  }

  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': buildOpacityWithHoverExpression(
          ['coalesce', ['get', 'fillOpacity'], 0],
          GRID_HOVER_FILL_OPACITY
        ),
        'fill-antialias': false,
      },
    });
  }

  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': '#ffffff',
        'line-width': 1.25,
        'line-opacity': ['coalesce', ['get', 'lineOpacity'], GRID_LINE_OPACITY],
      },
    });
  }
}

function syncViewportGrid() {
  const map = mapElement.getMap?.();
  if (!map) {
    log('map unavailable');
    return;
  }

  const viewport = mapViewportBounds(map);
  if (!viewport) {
    log('viewport unavailable');
    return;
  }

  const resolution = readResolution();
  const maxCells = readMaxCells();
  const tessellated = h3CellsForViewportBounds(viewport.bounds, {
    resolution,
    centerLat: viewport.centerLat,
    centerLng: viewport.centerLng,
  });
  const cells = prioritizeH3CellsNearCenter(
    tessellated,
    viewport.centerLat,
    viewport.centerLng,
    maxCells
  );

  visibleCellIds = new Set(
    cells.map((cell) => compactH3CellId(cell)).filter((id) => Boolean(id))
  );
  if (hoveredCellId && !visibleCellIds.has(hoveredCellId)) {
    clearGridHover(map);
  }

  ensureGridLayers(map);
  map.getSource(SOURCE_ID)?.setData?.(
    h3GridFeatureCollection(cells, {
      resolution,
      fillLevels: { new: 0, base: 0 },
      lineLevels: { new: GRID_LINE_OPACITY, base: GRID_LINE_OPACITY },
    })
  );

  log('grid sync', {
    resolution,
    cells: cells.length,
    capped: tessellated.length > cells.length,
    zoom: map.getZoom?.(),
  });
}

/** @param {import('maplibre-gl').Map} map */
function bindMapEvents(map) {
  if (gridBound) {
    syncViewportGrid();
    return;
  }
  gridBound = true;

  bindGridInteractivity(map);
  map.on('moveend', syncViewportGrid);
  map.on('zoomend', syncViewportGrid);
  map.on('dragstart', () => {
    gridDragging = true;
    pendingHoverLngLat = null;
    clearGridHover(map);
  });
  map.on('dragend', () => {
    gridDragging = false;
  });
  map.on('style.load', () => {
    hoveredCellId = null;
    ensureGridLayers(map);
    syncViewportGrid();
  });

  syncViewportGrid();
}

/** @param {import('maplibre-gl').Map} map */
function bindGridOnce(map) {
  if (!map) return;
  bindMapEvents(map);
}

mapElement?.addEventListener('gk-map-ready', () => {
  const map = mapElement.getMap?.();
  if (!map) {
    log('gk-map-ready but no map instance');
    return;
  }
  log('map-ready');
  bindGridOnce(map);
});

await setupMapsDemo({ elements: [] });

const existingMap = mapElement.getMap?.();
if (existingMap?.isStyleLoaded?.()) {
  log('map already ready on startup');
  bindGridOnce(existingMap);
} else if (existingMap) {
  existingMap.once('load', () => {
    log('map load after startup');
    bindGridOnce(existingMap);
  });
}

document.getElementById('resync').addEventListener('click', () => {
  syncViewportGrid();
});

resolutionInput.addEventListener('change', () => {
  syncViewportGrid();
});

maxCellsInput.addEventListener('change', () => {
  syncViewportGrid();
});
