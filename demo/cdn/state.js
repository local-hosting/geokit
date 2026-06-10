import {
  fetchStatesBulkGeoJson,
  prefetchStateBoundaries,
} from '../../src/cdn/bulk.ts';
import { boundsFromFeatures } from '../../src/cdn/bounds.ts';
import {
  addStateBoundaries,
  applyStateLinePaint,
  refreshStateBoundaries,
} from '../../src/ui/utils/admin-outline-preset.ts';
import {
  appendLog,
  fitBounds,
  getCdnOptions,
  wireMapDemo,
} from './shared.js';

import { mountDemoNavFromDocument } from '../shared/nav.js';

mountDemoNavFromDocument();
const logEl = document.getElementById('log');
const opts = getCdnOptions();
const mapReady = wireMapDemo(document.getElementById('map'));
void mapReady.then(() => document.getElementById('one').click());

function stateLineColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--bk-map-line').trim() || '#000';
}

const STATE_BOUNDARY_CONFIG = {
  sourceId: 'state-demo',
  lineLayerId: 'state-demo-line',
  lineColor: stateLineColor(),
  lineWidth: ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1, 12, 1.5],
};

function normalizeStateCode(code) {
  return code.trim().toLowerCase();
}

function featureMatchesState(feature, code) {
  const props = feature.properties ?? {};
  const target = normalizeStateCode(code);
  const candidates = [props.STUSPS, props.stusps, props.state, props.STATE, props.slug, props.GEOID]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  return candidates.includes(target);
}

async function statesForCodes(codes) {
  const bulk = await fetchStatesBulkGeoJson(opts);
  if (!bulk?.features?.length) return [];
  const unique = [...new Set(codes.map(normalizeStateCode))];
  const features = [];
  for (const code of unique) {
    const feature = bulk.features.find((item) => featureMatchesState(item, code));
    if (feature) features.push(feature);
  }
  return features;
}

async function showCollection(collection, label) {
  const map = await mapReady;
  if (!collection?.features?.length) {
    appendLog(logEl, `${label}: no features`);
    return;
  }
  const config = { ...STATE_BOUNDARY_CONFIG, lineColor: stateLineColor() };
  if (map.getLayer?.('state-demo-fill')) {
    map.removeLayer?.('state-demo-fill');
  }
  if (map.getSource?.(config.sourceId)) {
    refreshStateBoundaries(map, collection, config.sourceId);
    applyStateLinePaint(map, config);
  } else {
    addStateBoundaries(map, collection, config);
    applyStateLinePaint(map, config);
  }
  const bounds = boundsFromFeatures(collection.features);
  fitBounds(map, bounds);
  appendLog(logEl, label, {
    features: collection.features.length,
    bounds,
  });
}

document.getElementById('states-bulk').addEventListener('click', async () => {
  appendLog(logEl, 'fetchStatesBulkGeoJson()');
  prefetchStateBoundaries(opts);
  await showCollection(await fetchStatesBulkGeoJson(opts), 'states bulk');
});

document.getElementById('one').addEventListener('click', async () => {
  const code = document.getElementById('code').value.split(',')[0].trim();
  appendLog(logEl, `state from bulk (${code})`);
  const features = await statesForCodes([code]);
  await showCollection({ type: 'FeatureCollection', features }, 'one state');
});

document.getElementById('codes').addEventListener('click', async () => {
  const codes = document
    .getElementById('code')
    .value.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  appendLog(logEl, `states from bulk (${codes.join(', ')})`);
  const features = await statesForCodes(codes);
  await showCollection({ type: 'FeatureCollection', features }, 'state codes');
});
