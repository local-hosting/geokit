import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { buildFacetFilterExpression } from '../../packages/core/src/ui/map-facet-filters.ts';

const mapElement = document.getElementById('facet-filters-map');
const logEl = document.getElementById('log');

const SOURCE_ID = 'facet-demo-points';
const LAYER_ID = 'facet-demo-circles';

const DEMO_FEATURES = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { category: 'alpha' }, geometry: { type: 'Point', coordinates: [-74.01, 40.75] } },
    { type: 'Feature', properties: { category: 'beta' }, geometry: { type: 'Point', coordinates: [-73.98, 40.73] } },
    { type: 'Feature', properties: { category: 'gamma' }, geometry: { type: 'Point', coordinates: [-73.95, 40.71] } },
    { type: 'Feature', properties: { category: 'alpha' }, geometry: { type: 'Point', coordinates: [-74.04, 40.7] } },
    { type: 'Feature', properties: { category: 'beta' }, geometry: { type: 'Point', coordinates: [-73.92, 40.76] } },
  ],
};

const CATEGORY_COLORS = {
  alpha: '#60a5fa',
  beta: '#f472b6',
  gamma: '#fbbf24',
};

function selectedCategories() {
  return ['alpha', 'beta', 'gamma'].filter((id) => document.getElementById(`cat-${id}`).checked);
}

function currentFilter() {
  return buildFacetFilterExpression({
    property: 'category',
    selectedValues: selectedCategories(),
    normalize: true,
  });
}

function logFilter() {
  const filter = currentFilter();
  logEl.textContent = JSON.stringify(filter ?? ['literal', true], null, 2);
}

/** @param {import('maplibre-gl').Map} map */
function ensureLayers(map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: 'geojson', data: DEMO_FEATURES });
  }

  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': 10,
        'circle-color': [
          'match',
          ['downcase', ['coalesce', ['get', 'category'], '']],
          'alpha',
          CATEGORY_COLORS.alpha,
          'beta',
          CATEGORY_COLORS.beta,
          'gamma',
          CATEGORY_COLORS.gamma,
          '#ffffff',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0f172a',
      },
    });
  }
}

function applyFilter() {
  const map = mapElement.getMap?.();
  if (!map?.getLayer(LAYER_ID)) return;
  const filter = currentFilter();
  map.setFilter(LAYER_ID, filter ?? true);
  logFilter();
}

/** @param {import('maplibre-gl').Map} map */
function bindMap(map) {
  ensureLayers(map);
  applyFilter();
}

mapElement?.addEventListener('gk-map-ready', () => {
  const map = mapElement.getMap?.();
  if (map) bindMap(map);
});

await setupMapsDemo({ elements: [] });

const existingMap = mapElement.getMap?.();
if (existingMap?.isStyleLoaded?.()) {
  bindMap(existingMap);
} else if (existingMap) {
  existingMap.once('load', () => bindMap(existingMap));
}

document.getElementById('apply').addEventListener('click', applyFilter);
for (const id of ['alpha', 'beta', 'gamma']) {
  document.getElementById(`cat-${id}`).addEventListener('change', applyFilter);
}
