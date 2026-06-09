import { fetchCountyShapeFeature } from '../../src/cdn/county.ts';
import { boundsFromFeature } from '../../src/cdn/bounds.ts';
import { calculateCenterAndZoom } from '../../src/utils/bounds/calculate-zoom.ts';
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

document.getElementById('load').addEventListener('click', async () => {
  const fips = document.getElementById('fips').value.trim();
  const feature = await fetchCountyShapeFeature(fips, opts);
  if (!feature) {
    appendLog(logEl, 'feature null');
    return;
  }
  const bounds = boundsFromFeature(feature);
  const viewport = bounds ? calculateCenterAndZoom(bounds) : null;
  setGeoJsonOutline(map, 'bounds-demo', feature);
  fitBounds(map, bounds);
  appendLog(logEl, 'boundsFromFeature', { bounds, viewport });
});
