import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { cellToLatLng, latLngToCell } from 'h3-js';
import {
  filterCellsInCoverage,
  viewportCoverageCells,
} from '../../packages/h3/src/viewport/viewport-coverage.ts';
import { h3CellsForViewportBounds, h3GridFeatureCollection } from '../../packages/h3/src/viewport/viewport.ts';
import { compactH3CellId, expandH3CellId } from '../../packages/h3/src/cell/cell-id.ts';
import { normalizeH3CellToResolution } from '../../packages/h3/src/cell/cell-id-resolution.ts';
import { mapViewportBounds } from '../../packages/h3/src/viewport/map-viewport.ts';

const mapElement = document.getElementById('h3-coverage-map');
const resolutionInput = document.getElementById('resolution');
const logEl = document.getElementById('log');

const SOURCE_ID = 'h3-coverage-grid';
const FILL_LAYER_ID = 'h3-coverage-grid-fill';
const LINE_LAYER_ID = 'h3-coverage-grid-line';

const METRO_POINTS = [
  { label: 'NYC', lat: 40.7128, lng: -74.006 },
  { label: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { label: 'LA', lat: 34.0522, lng: -118.2437 },
];

/** @type {Set<string>} */
let coverageIndex = new Set();

function readResolution() {
  const parsed = Number.parseInt(resolutionInput.value, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(Math.max(parsed, 1), 5);
}

function rebuildCoverageIndex(resolution) {
  coverageIndex = new Set(
    METRO_POINTS.map((metro) => {
      const cell = latLngToCell(metro.lat, metro.lng, resolution);
      return normalizeH3CellToResolution(cell, resolution);
    })
  );
}

function log(message, detail) {
  const line = detail === undefined ? message : `${message} ${JSON.stringify(detail)}`;
  logEl.textContent = line;
  console.log('[gk-h3]', message, detail ?? '');
}

/** @param {import('../../packages/h3/src/viewport/viewport.ts').ViewportBounds} bounds */
function coverageIndexCellsInBounds(bounds) {
  const visible = [];
  for (const cell of coverageIndex) {
    const [lat, lng] = cellToLatLng(expandH3CellId(cell));
    if (lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east) {
      visible.push(cell);
    }
  }
  return visible;
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
        'fill-color': '#22c55e',
        'fill-opacity': 0.2,
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
        'line-color': '#86efac',
        'line-width': 1.25,
        'line-opacity': 0.85,
      },
    });
  }
}

function syncCoverageGrid() {
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
  rebuildCoverageIndex(resolution);

  const tessellated = h3CellsForViewportBounds(viewport.bounds, {
    resolution,
    centerLat: viewport.centerLat,
    centerLng: viewport.centerLng,
    fallbackDiskK: 2,
  });

  let cells = filterCellsInCoverage(tessellated, coverageIndex, resolution);
  let mode = 'tessellation';

  if (cells.length === 0) {
    cells = coverageIndexCellsInBounds(viewport.bounds);
    mode = tessellated.length === 0 ? 'index-in-viewport (tessellation capped)' : 'index-in-viewport';
  }

  ensureGridLayers(map);
  map.getSource(SOURCE_ID)?.setData?.(
    h3GridFeatureCollection(cells, {
      resolution,
      fillLevels: { new: 0.2, base: 0.2 },
      lineLevels: { new: 0.85, base: 0.85 },
    })
  );

  log('coverage sync', {
    resolution,
    mode,
    tessellated: tessellated.length,
    indexCells: coverageIndex.size,
    visible: cells.length,
    metros: METRO_POINTS.map((m) => m.label),
    sample: cells.slice(0, 3).map((c) => compactH3CellId(c)),
  });
}

/** @param {import('maplibre-gl').Map} map */
function bindMapEvents(map) {
  map.on('moveend', syncCoverageGrid);
  map.on('zoomend', syncCoverageGrid);
  map.on('style.load', () => {
    ensureGridLayers(map);
    syncCoverageGrid();
  });
  syncCoverageGrid();
}

mapElement?.addEventListener('gk-map-ready', () => {
  const map = mapElement.getMap?.();
  if (map) bindMapEvents(map);
});

await setupMapsDemo({ elements: [] });

const existingMap = mapElement.getMap?.();
if (existingMap?.isStyleLoaded?.()) {
  bindMapEvents(existingMap);
} else if (existingMap) {
  existingMap.once('load', () => bindMapEvents(existingMap));
}

document.getElementById('resync').addEventListener('click', syncCoverageGrid);
document.getElementById('rebuild-index').addEventListener('click', () => {
  rebuildCoverageIndex(readResolution());
  syncCoverageGrid();
});

resolutionInput.addEventListener('change', syncCoverageGrid);
