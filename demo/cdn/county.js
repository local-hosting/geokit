import {
  fetchCountyShapeFeature,
  fetchCountyShapesForFips,
} from '../../src/cdn/county.ts';
import { boundsFromFeatures } from '../../src/cdn/bounds.ts';
import {
  appendLog,
  fitBounds,
  getCdnOptions,
  setGeoJsonOutline,
  wireMapDemo,
} from './shared.js';

import { mountDemoNavFromDocument } from '../shared/nav.js';

mountDemoNavFromDocument();
const logEl = document.getElementById('log');
const opts = getCdnOptions();
const mapReady = wireMapDemo(document.getElementById('map'));
void mapReady.then(() => document.getElementById('one').click());

async function showCollection(collection, label) {
  const map = await mapReady;
  if (!collection?.features?.length) {
    appendLog(logEl, `${label}: no features`);
    return;
  }
  setGeoJsonOutline(map, 'county-demo', collection);
  const bounds = boundsFromFeatures(collection.features);
  fitBounds(map, bounds);
  appendLog(logEl, label, {
    features: collection.features.length,
    bounds,
  });
}

document.getElementById('one').addEventListener('click', async () => {
  const fips = document.getElementById('fips').value.split(',')[0].trim();
  appendLog(logEl, `fetchCountyShapeFeature(${fips})`);
  const feature = await fetchCountyShapeFeature(fips, opts);
  if (!feature) {
    appendLog(logEl, 'null');
    return;
  }
  await showCollection({ type: 'FeatureCollection', features: [feature] }, 'one county');
});

document.getElementById('bulk').addEventListener('click', async () => {
  const fips = document
    .getElementById('fips')
    .value.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  appendLog(logEl, `fetchCountyShapesForFips(${fips.join(', ')})`);
  const features = await fetchCountyShapesForFips(fips, opts);
  await showCollection({ type: 'FeatureCollection', features }, 'bulk counties');
});
