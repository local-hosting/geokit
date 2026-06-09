import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import {
  canonicalDmaCdnSlug,
  prefetchDmaRegionsForViewportBounds,
  resolveGlobeCdnBaseUrl,
  validateIdentityJwt,
} from '../../src/cdn/index.ts';
import { approximateViewportBoundsFromCenterZoom } from '../../src/utils/h3/map-viewport.ts';
import { appendLog } from '../cdn/shared.js';

const logEl = document.getElementById('log');
const jwtInput = document.getElementById('jwt');
const slugInput = document.getElementById('slug');
const slugField = document.getElementById('slug-field');
const scopeAll = document.getElementById('scope-all');
const scopeOne = document.getElementById('scope-one');
const mapElement = document.getElementById('dma-map');

const demoStartedAt = performance.now();

function log(message, detail) {
  appendLog(logEl, message, detail);
}

function perfMark(name) {
  performance.mark(name);
  log(`perf ${name}`, { ms: Math.round(performance.now() - demoStartedAt) });
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

function isOneScope() {
  return scopeOne.checked;
}

function syncSlugFieldVisibility() {
  slugField.classList.toggle('hidden', !isOneScope());
}

function applyScope({ fly = true } = {}) {
  const layer = dmaLayer();
  if (!layer) return;

  syncSlugFieldVisibility();
  wireJwtOnDmaLayer();

  if (isOneScope()) {
    const slug = canonicalDmaCdnSlug(slugInput.value.trim());
    layer.setAttribute('mode', 'slugs');
    layer.setAttribute('slugs', slug);
    layer.setAttribute('highlight-slug', slug);
    log('scope: one', { slug });
    if (fly && typeof mapElement.flyTo === 'function') {
      mapElement.flyTo(30.2672, -97.7431, 8);
    }
  } else {
    layer.removeAttribute('slugs');
    layer.removeAttribute('highlight-slug');
    layer.setAttribute('mode', 'viewport');
    log('scope: all');
    if (fly && typeof mapElement.flyTo === 'function') {
      mapElement.flyTo(37.19326, -99.21257, 4.39);
    }
  }
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

function prefetchMapLayers() {
  if (isOneScope()) return;
  const baseUrl = resolveGlobeCdnBaseUrl();
  const cdnOpts = { baseUrl, init: dmaRequestInit(), getRequestInit: dmaRequestInit };
  const lat = Number(mapElement.getAttribute('lat'));
  const lng = Number(mapElement.getAttribute('lng'));
  const zoom = Number(mapElement.getAttribute('zoom'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return;

  const bounds = approximateViewportBoundsFromCenterZoom(
    lat,
    lng,
    zoom,
    window.innerWidth,
    window.innerHeight
  );
  prefetchDmaRegionsForViewportBounds(bounds, cdnOpts);
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

syncSlugFieldVisibility();
wireJwtOnDmaLayer();
prefetchMapLayers();
perfMark('prefetch-started');

scopeAll.addEventListener('change', () => {
  applyScope();
});

scopeOne.addEventListener('change', () => {
  applyScope();
});

slugInput.addEventListener('change', () => {
  if (isOneScope()) applyScope({ fly: true });
});

document.getElementById('apply').addEventListener('click', () => {
  applyScope({ fly: isOneScope() });
  void reloadDmaLayer();
});

document.getElementById('fetch-dev-token').addEventListener('click', () => {
  void fetchDevIdentityToken().then(() => {
    applyScope({ fly: false });
    void reloadDmaLayer();
  });
});

jwtInput.addEventListener('change', () => {
  void reloadDmaLayer();
});

let firstShardAt = null;

mapElement.addEventListener('gk-layer-ready', (event) => {
  perfMark(`layer-ready-${event.detail?.dataset ?? 'unknown'}`);
  log('gk-layer-ready', event.detail);
});

mapElement.addEventListener('gk-layer-shard', (event) => {
  if (!firstShardAt) {
    firstShardAt = performance.now();
    perfMark('first-dma-shard');
  }
  log('gk-layer-shard', event.detail);
});

mapElement.addEventListener('gk-layer-click', (event) => {
  const slug = event.detail?.feature?.properties?.slug;
  log('gk-layer-click', { slug, layerId: event.detail?.layerId });
});

mapElement.addEventListener('gk-map-ready', () => {
  logEl.textContent = '';
  perfMark('map-ready');
});
