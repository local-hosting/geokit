import {
  fetchStateCitiesGeoJson,
  fetchStatePlaceCatalog,
  fetchStatePlaceFeature,
} from '../../src/cdn/place.ts';
import { boundsFromFeature } from '../../src/cdn/bounds.ts';
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
let map;

wireMapDemo(document.getElementById('map'), (m) => {
  map = m;
});

document.getElementById('catalog').addEventListener('click', async () => {
  const state = document.getElementById('state').value.trim();
  const entries = await fetchStatePlaceCatalog(state, opts);
  appendLog(logEl, `catalog (${entries.length} entries)`, entries.slice(0, 8));
});

document.getElementById('cities').addEventListener('click', async () => {
  const state = document.getElementById('state').value.trim();
  const geojson = await fetchStateCitiesGeoJson(state, opts);
  if (!geojson) {
    appendLog(logEl, 'cities bulk: null');
    return;
  }
  setGeoJsonOutline(map, 'place-demo', geojson);
  appendLog(logEl, 'cities bulk', { features: geojson.features.length });
});

document.getElementById('one').addEventListener('click', async () => {
  const state = document.getElementById('state').value.trim();
  const place = document.getElementById('place').value.trim();
  appendLog(logEl, `fetchStatePlaceFeature(${state}, ${place})`);
  const feature = await fetchStatePlaceFeature(state, place, opts);
  if (!feature) {
    appendLog(logEl, 'null — try another slug from catalog');
    return;
  }
  setGeoJsonOutline(map, 'place-demo', feature);
  fitBounds(map, boundsFromFeature(feature));
  appendLog(logEl, 'place feature', feature.properties);
});
