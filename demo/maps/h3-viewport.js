import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import {
  h3CellsForViewportBounds,
  prioritizeH3CellsNearCenter,
} from '../../src/utils/h3/viewport.ts';
import { compactH3CellId, expandH3CellId } from '../../src/utils/h3/cell-id.ts';
import { mapViewportBounds } from '../../src/utils/h3/map-viewport.ts';

const mapElement = document.getElementById('h3-viewport-map');
const resolutionInput = document.getElementById('resolution');
const maxCellsInput = document.getElementById('max-cells');

/** @type {Map<string, HTMLElement>} */
const mounted = new Map();

/** @param {string} message @param {unknown} [detail] */
function log(message, detail) {
  if (detail === undefined) {
    console.log(`[H3Viewport] ${message}`);
    return;
  }
  console.log(`[H3Viewport] ${message}`, detail);
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

function createH3Element(cellId) {
  const el = document.createElement('gk-h3');
  el.setAttribute('h3-index', expandH3CellId(cellId));
  el.setAttribute('opacity', '0');
  el.setAttribute('stroke-color', 'rgba(255, 255, 255, 0.28)');
  el.setAttribute('stroke-width', '1.25');
  el.setAttribute('interactive', 'true');
  return el;
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

  const wanted = new Set(
    cells.map((cell) => compactH3CellId(cell)).filter((id) => Boolean(id))
  );

  for (const [id, el] of mounted) {
    if (wanted.has(id)) continue;
    el.remove();
    mounted.delete(id);
  }

  for (const cell of cells) {
    const id = compactH3CellId(cell);
    if (!id || mounted.has(id)) continue;
    const el = createH3Element(id);
    mapElement.appendChild(el);
    mounted.set(id, el);
  }

  log('grid sync', {
    resolution,
    cells: wanted.size,
    capped: tessellated.length > wanted.size,
    zoom: map.getZoom?.(),
  });
}

function bindMapEvents() {
  const map = mapElement.getMap?.();
  if (!map) return;

  const onViewportChange = () => syncViewportGrid();
  map.on('moveend', onViewportChange);
  map.on('zoomend', onViewportChange);
  syncViewportGrid();
}

await setupMapsDemo({ elements: ['h3'] });

document.getElementById('resync').addEventListener('click', () => {
  syncViewportGrid();
});

resolutionInput.addEventListener('change', () => {
  for (const el of mounted.values()) el.remove();
  mounted.clear();
  syncViewportGrid();
});

maxCellsInput.addEventListener('change', () => {
  syncViewportGrid();
});

mapElement.addEventListener('gk-map-ready', () => {
  log('map-ready');
  bindMapEvents();
});

mapElement.addEventListener('h3-click', (event) => {
  const el = event.detail?.element;
  const h3Index =
    el?.getH3Index?.() ??
    event.detail?.features?.[0]?.properties?.h3 ??
    event.detail?.features?.[0]?.properties?.resolution;
  log('h3-click', { h3: h3Index });
});
