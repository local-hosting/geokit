import { fetchCountyShapeFeature } from '../../src/cdn/county.ts';
import { boundsFromFeature } from '../../src/cdn/bounds.ts';
import { calculateCenterAndZoom } from '../../src/utils/bounds/calculate-zoom.ts';
import {
  appendLog,
  fitBounds,
  getCdnOptions,
  setBoundsOverlay,
  setGeoJsonOutline,
  wireMapDemo,
} from './shared.js';

import { mountDemoNavFromDocument } from '../shared/nav.js';

mountDemoNavFromDocument();
const logEl = document.getElementById('log');
const opts = getCdnOptions();
const mapReady = wireMapDemo(document.getElementById('map'));

document.getElementById('load').addEventListener('click', async () => {
  const map = await mapReady;
  const fips = document.getElementById('fips').value.trim();
  const feature = await fetchCountyShapeFeature(fips, opts);
  if (!feature) {
    appendLog(logEl, 'feature null');
    return;
  }
  const bounds = boundsFromFeature(feature);
  const viewport = bounds ? calculateCenterAndZoom(bounds) : null;
  setGeoJsonOutline(map, 'bounds-feature', feature);
  setBoundsOverlay(map, 'bounds-box', bounds);
  fitBounds(map, bounds);
  appendLog(logEl, 'boundsFromFeature', { bounds, viewport });
});
