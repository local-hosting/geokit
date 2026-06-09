import {
  BOROUGH_COUNTY_ALIASES,
  resolvePlaceOrBoroughBounds,
  resolveShapeBounds,
} from '../../src/cdn/resolve-shape.ts';
import { fetchCountyShapeFeature } from '../../src/cdn/county.ts';
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
const modeEl = document.getElementById('mode');
let map;

const wraps = {
  fips: document.getElementById('fips-wrap'),
  place: [document.getElementById('state-wrap'), document.getElementById('place-wrap')],
  borough: document.getElementById('borough-wrap'),
};

function syncMode() {
  const mode = modeEl.value;
  wraps.fips.hidden = mode !== 'fips';
  wraps.place.forEach((el) => {
    el.hidden = mode !== 'place';
  });
  wraps.borough.hidden = mode !== 'borough';
}

modeEl.addEventListener('change', syncMode);
syncMode();

wireMapDemo(document.getElementById('map'), (m) => {
  map = m;
});

appendLog(logEl, 'BOROUGH_COUNTY_ALIASES keys', Object.keys(BOROUGH_COUNTY_ALIASES));

document.getElementById('resolve').addEventListener('click', async () => {
  const mode = modeEl.value;
  let bounds = null;
  let label = '';

  if (mode === 'fips') {
    const fips = document.getElementById('fips').value.trim();
    label = `resolveShapeBounds({ countyFips: ${fips} })`;
    bounds = await resolveShapeBounds({ countyFips: fips }, opts);
    const feature = await fetchCountyShapeFeature(fips, opts);
    if (feature) setGeoJsonOutline(map, 'resolve-demo', feature);
  } else if (mode === 'place') {
    const state = document.getElementById('state').value.trim();
    const place = document.getElementById('place').value.trim();
    label = `resolveShapeBounds({ state: ${state}, place: ${place} })`;
    bounds = await resolveShapeBounds({ state, place }, opts);
  } else {
    const borough = document.getElementById('borough').value.trim();
    label = `resolvePlaceOrBoroughBounds(ny, ${borough})`;
    bounds = await resolvePlaceOrBoroughBounds('ny', borough, opts);
    const alias = BOROUGH_COUNTY_ALIASES[borough.toLowerCase()];
    if (alias) {
      const feature = await fetchCountyShapeFeature(alias.countyFips, opts);
      if (feature) setGeoJsonOutline(map, 'resolve-demo', feature);
    }
  }

  appendLog(logEl, label, {
    bounds,
    viewport: bounds ? calculateCenterAndZoom(bounds) : null,
  });
  fitBounds(map, bounds);
});
