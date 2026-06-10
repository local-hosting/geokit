import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { validateIdentityJwt } from '../../src/cdn/index.ts';
import { appendLog } from '../cdn/shared.js';

const logEl = document.getElementById('log');
const jwtInput = document.getElementById('jwt');
const mapElement = document.getElementById('paint-hero-map');

function log(message, detail) {
  appendLog(logEl, message, detail);
}

function dmaLayer() {
  return mapElement.querySelector('gk-layer[dataset="dma"]');
}

function dmaRequestInit() {
  const headers = { Accept: 'application/json' };
  const raw = jwtInput.value.trim();
  if (raw) {
    headers.Authorization = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
  }
  return { headers };
}

function wireJwtOnDmaLayer() {
  const layer = dmaLayer();
  if (!layer) return;
  layer.getRequestInit = dmaRequestInit;
}

async function reloadDmaLayer() {
  const layer = dmaLayer();
  if (!layer) {
    log('dma layer not found');
    return;
  }
  wireJwtOnDmaLayer();
  if (typeof layer.reloadDataset !== 'function') {
    log('reloadDataset unavailable');
    return;
  }
  await layer.reloadDataset();
}

async function fetchDevIdentityToken() {
  if (jwtInput.value.trim()) return jwtInput.value.trim();
  log('GET /api/cdn/identity-token');
  try {
    const res = await fetch('/api/cdn/identity-token', { credentials: 'same-origin' });
    if (!res.ok) {
      log('dev token failed', { status: res.status });
      return null;
    }
    const body = await res.json();
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) {
      log('dev token empty');
      return null;
    }
    jwtInput.value = token;
    log('dev token loaded', validateIdentityJwt(token));
    return token;
  } catch (err) {
    log('dev token error', String(err));
    return null;
  }
}

await Promise.all([
  fetchDevIdentityToken(),
  setupMapsDemo({ elements: ['layer'] }),
]);

wireJwtOnDmaLayer();

document.getElementById('fetch-dev-token').addEventListener('click', () => {
  void fetchDevIdentityToken().then(() => reloadDmaLayer());
});

document.getElementById('reload').addEventListener('click', () => {
  void reloadDmaLayer();
});

jwtInput.addEventListener('change', () => {
  void reloadDmaLayer();
});

mapElement.addEventListener('gk-layer-ready', (event) => {
  log('gk-layer-ready', event.detail);
});

mapElement.addEventListener('gk-layer-shard', (event) => {
  log('gk-layer-shard', event.detail);
});

mapElement.addEventListener('gk-layer-click', (event) => {
  const slug = event.detail?.feature?.properties?.slug;
  log('gk-layer-click', { slug, layerId: event.detail?.layerId });
});

mapElement.addEventListener('gk-map-ready', () => {
  log('map-ready', {
    lat: mapElement.getAttribute('lat'),
    lng: mapElement.getAttribute('lng'),
    zoom: mapElement.getAttribute('zoom'),
    style: mapElement.getAttribute('map-style'),
  });
});
