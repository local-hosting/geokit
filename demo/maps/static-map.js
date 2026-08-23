import { mountDemoNavFromDocument } from '../shared/nav.js';
import { maptilerStaticAdapter } from '../../packages/core/src/static-map/providers/maptiler.ts';

mountDemoNavFromDocument();
document.body.classList.add('demo-has-nav');

const logEl = document.getElementById('log');
const previewEl = document.getElementById('preview');
const urlEl = document.getElementById('url');

const maptilerKey = import.meta.env.MAPTILER_KEY;

function readNumber(id, fallback) {
  const parsed = Number.parseFloat(document.getElementById(id).value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function renderSnapshot() {
  const lat = readNumber('lat', 40.7128);
  const lng = readNumber('lng', -74.006);
  const zoom = readNumber('zoom', 11);
  const width = Math.round(readNumber('width', 640));
  const height = Math.round(readNumber('height', 400));

  if (!maptilerKey) {
    logEl.textContent = 'MAPTILER_KEY missing — set it in the demo env to fetch snapshots.';
    previewEl.hidden = true;
    urlEl.textContent = '';
    return;
  }

  const url = maptilerStaticAdapter.buildCenterUrl({
    style: 'dataviz-dark',
    apiKey: maptilerKey,
    viewport: { lat, lng, zoom },
    dimensions: { width, height, format: 'png' },
  });

  logEl.textContent = `Built static map URL (${width}×${height} @ z${zoom}).`;
  urlEl.textContent = url;
  previewEl.hidden = false;
  previewEl.src = url;
}

document.getElementById('render').addEventListener('click', renderSnapshot);

if (maptilerKey) {
  renderSnapshot();
} else {
  logEl.textContent = 'MAPTILER_KEY missing — URL builder still works once a key is set.';
}
