import {
  countiesBulkUrl,
  countyShapeUrl,
  globeCountyShapeUrl,
  stateCitiesBulkUrl,
  stateCitiesCatalogUrl,
  statesBulkUrl,
} from '../../src/cdn/paths.ts';
import { mountDemoNav } from '../nav.js';
import { appendLog, cdnBaseLabel } from './shared.js';

mountDemoNav('paths');
const logEl = document.getElementById('log');
const base = cdnBaseLabel();

document.getElementById('build').addEventListener('click', () => {
  const fips = document.getElementById('fips').value.trim();
  const state = document.getElementById('state').value.trim().toLowerCase();
  logEl.textContent = '';
  appendLog(logEl, 'globeCountyShapeUrl', globeCountyShapeUrl(fips));
  appendLog(logEl, 'countyShapeUrl', countyShapeUrl(base, fips));
  appendLog(logEl, 'stateCitiesCatalogUrl', stateCitiesCatalogUrl(base, state));
  appendLog(logEl, 'stateCitiesBulkUrl', stateCitiesBulkUrl(base, state));
  appendLog(logEl, 'countiesBulkUrl', countiesBulkUrl(base));
  appendLog(logEl, 'statesBulkUrl', statesBulkUrl(base));
});
document.getElementById('build').click();
