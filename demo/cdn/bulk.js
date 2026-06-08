import {
  fetchCountiesBulkGeoJson,
  fetchStatesBulkGeoJson,
  prefetchBoundaryOutlines,
} from '../../src/cdn/bulk.ts';
import { boundsFromFeatures } from '../../src/cdn/bounds.ts';
import {
  appendLog,
  fitBounds,
  getCdnOptions,
  setGeoJsonOutline,
  wireMapDemo,
} from './shared.js';

import { mountDemoNav } from '../nav.js';

mountDemoNav('bulk');
const logEl = document.getElementById('log');
const opts = getCdnOptions();
let map;

wireMapDemo(document.getElementById('map'), (m) => {
  map = m;
});

async function showCollection(collection, label) {
  if (!collection?.features?.length) {
    appendLog(logEl, `${label}: no features`);
    return;
  }
  setGeoJsonOutline(map, 'bulk-demo', collection);
  fitBounds(map, boundsFromFeatures(collection.features));
  appendLog(logEl, label, { features: collection.features.length });
}

document.getElementById('counties').addEventListener('click', async () => {
  appendLog(logEl, 'fetchCountiesBulkGeoJson()');
  await showCollection(await fetchCountiesBulkGeoJson(opts), 'counties bulk');
});

document.getElementById('states').addEventListener('click', async () => {
  appendLog(logEl, 'fetchStatesBulkGeoJson()');
  await showCollection(await fetchStatesBulkGeoJson(opts), 'states bulk');
});

document.getElementById('both').addEventListener('click', async () => {
  appendLog(logEl, 'prefetchBoundaryOutlines()');
  prefetchBoundaryOutlines(opts);
  const [counties, states] = await Promise.all([
    fetchCountiesBulkGeoJson(opts),
    fetchStatesBulkGeoJson(opts),
  ]);
  appendLog(logEl, 'prefetch done', {
    counties: counties?.features?.length ?? 0,
    states: states?.features?.length ?? 0,
  });
});
