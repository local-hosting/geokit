import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { calculateFitBoundsViewport } from '../../src/core/src/utils/bounds/fit-viewport.ts';

const mapElement = document.getElementById('fit-bounds-map');
const logEl = document.getElementById('log');

const PRESETS = {
  nyc: [-74.05, 40.65, -73.85, 40.85],
  boston: [-71.2, 42.2, -70.9, 42.4],
  conus: [-125.0, 24.396308, -66.93457, 49.384358],
};

const BOX_SOURCE_ID = 'fit-bounds-box';
const BOX_LAYER_FILL = 'fit-bounds-box-fill';
const BOX_LAYER_LINE = 'fit-bounds-box-line';

function readNumber(id, fallback) {
  const parsed = Number.parseInt(document.getElementById(id).value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function currentBounds() {
  const key = document.getElementById('preset').value;
  return PRESETS[key] ?? PRESETS.nyc;
}

function boundsToFeature(bounds) {
  const [west, south, east, north] = bounds;
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
    properties: {},
  };
}

/** @param {import('maplibre-gl').Map} map */
function ensureBoxLayers(map) {
  if (!map.getSource(BOX_SOURCE_ID)) {
    map.addSource(BOX_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(BOX_LAYER_FILL)) {
    map.addLayer({
      id: BOX_LAYER_FILL,
      type: 'fill',
      source: BOX_SOURCE_ID,
      paint: {
        'fill-color': '#38bdf8',
        'fill-opacity': 0.12,
      },
    });
  }

  if (!map.getLayer(BOX_LAYER_LINE)) {
    map.addLayer({
      id: BOX_LAYER_LINE,
      type: 'line',
      source: BOX_SOURCE_ID,
      paint: {
        'line-color': '#38bdf8',
        'line-width': 2,
      },
    });
  }
}

function showBoundsBox() {
  const map = mapElement.getMap?.();
  if (!map) return;
  const bounds = currentBounds();
  ensureBoxLayers(map);
  map.getSource(BOX_SOURCE_ID)?.setData?.({
    type: 'FeatureCollection',
    features: [boundsToFeature(bounds)],
  });
  logEl.textContent = `BBox: ${bounds.join(', ')}`;
}

function fitBounds() {
  const bounds = currentBounds();
  const width = readNumber('width', 900);
  const height = readNumber('height', 600);
  const viewport = calculateFitBoundsViewport(bounds, width, height, 0.06);

  logEl.textContent = JSON.stringify({ bounds, width, height, viewport }, null, 2);
  showBoundsBox();

  if (typeof mapElement.flyTo === 'function') {
    mapElement.flyTo(viewport.lat, viewport.lng, viewport.zoom);
  }
}

mapElement?.addEventListener('gk-map-ready', () => {
  showBoundsBox();
});

await setupMapsDemo({ elements: [] });

const existingMap = mapElement.getMap?.();
if (existingMap?.isStyleLoaded?.()) {
  showBoundsBox();
} else if (existingMap) {
  existingMap.once('load', showBoundsBox);
}

document.getElementById('fit').addEventListener('click', fitBounds);
document.getElementById('show-box').addEventListener('click', showBoundsBox);
document.getElementById('preset').addEventListener('change', showBoundsBox);
