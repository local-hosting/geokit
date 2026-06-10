/**
 * Interactive geokit host for open_map / show_map — mirrors demo/maps bootstrap.
 */
import '@geokit-src/ui/theme.css';
import { configure } from '@geokit-src/ui/providers/registry.ts';
import {
  defaultMcpMapStyle,
  MCP_DMA_LAYER_FILL_OPACITY,
  MCP_DMA_VIEWPORT_FILL_OPACITY,
  MCP_DMA_LAYER_LINE_WIDTH,
  resolveMcpMapTheme,
  resolveMcpRegionHexColors,
} from '@geokit-src/mcp/map-presentation.ts';
import { resolveInteractiveMapCredentials } from '@geokit-src/mcp/resolve-map-provider-env.ts';
import { parseMapHostBounds, parseMapHostRegionLayer } from '@geokit-src/mcp/open-map.ts';
import { DEFAULT_MAP_FIT_PADDING } from '@geokit-src/mcp/static-map.ts';
import { staticMapPaddingPx } from '@geokit-src/mcp/static-map-dimensions.ts';

const params = new URLSearchParams(window.location.search);
const lat = Number(params.get('lat') ?? '39.8283');
const lng = Number(params.get('lng') ?? '-98.5795');
const zoom = Number(params.get('zoom') ?? '4');
const theme = resolveMcpMapTheme(params.get('theme'));
const providerHint = params.get('provider')?.trim() || undefined;
const regionLayer = parseMapHostRegionLayer(params);
const shapeBounds = parseMapHostBounds(params.get('bounds'));

const browserEnv = {
  GEOKIT_MAP_PROVIDER: import.meta.env.GEOKIT_MAP_PROVIDER,
  MAP_PROVIDER: import.meta.env.MAP_PROVIDER,
  GEOKIT_MAP_API_KEY: import.meta.env.GEOKIT_MAP_API_KEY,
  MAP_API_KEY: import.meta.env.MAP_API_KEY,
  MAPTILER_KEY: import.meta.env.MAPTILER_KEY,
  GEOKIT_MAPTILER_KEY: import.meta.env.GEOKIT_MAPTILER_KEY,
  MAPBOX_TOKEN: import.meta.env.MAPBOX_TOKEN,
  MAPBOX_ACCESS_TOKEN: import.meta.env.MAPBOX_ACCESS_TOKEN,
  GEOKIT_MAPBOX_KEY: import.meta.env.GEOKIT_MAPBOX_KEY,
};

const { providerId, apiKey, maptilerApiKey, mapboxAccessToken } =
  resolveInteractiveMapCredentials(browserEnv, { providerHint });

if (!apiKey) {
  console.warn('[map-host] No map credentials — set MAPTILER_KEY or MAPBOX_TOKEN in packages/geokit/.env');
}

configure({
  maptiler: { apiKey: maptilerApiKey },
  mapbox: { accessToken: mapboxAccessToken },
});

const mapStyle = params.get('style')?.trim() || defaultMcpMapStyle(providerId);
const mapElement = document.getElementById('open-map');

if (mapElement) {
  mapElement.setAttribute('provider', providerId);
  mapElement.setAttribute('lat', String(lat));
  mapElement.setAttribute('lng', String(lng));
  mapElement.setAttribute('zoom', String(zoom));
  mapElement.setAttribute('theme', theme);
  mapElement.setAttribute('map-style', mapStyle);
  if (providerId === 'mapbox' && mapboxAccessToken) {
    mapElement.setAttribute('access-token', mapboxAccessToken);
  } else if (providerId === 'maptiler' && maptilerApiKey) {
    mapElement.setAttribute('api-key', maptilerApiKey);
  }
}

await import('@geokit-src/ui/core.ts');
await import('@geokit-src/ui/components/elements/layer/layer.ts');

let cachedCdnJwt = '';

async function fetchCdnIdentityToken() {
  if (cachedCdnJwt) return cachedCdnJwt;
  try {
    const res = await fetch('/api/cdn/identity-token', { credentials: 'same-origin' });
    if (!res.ok) return '';
    const body = await res.json();
    const token = typeof body.token === 'string' ? body.token : '';
    cachedCdnJwt = token;
    return token;
  } catch {
    return '';
  }
}

function cdnRequestInit() {
  const headers = { Accept: 'application/json' };
  const raw = cachedCdnJwt.trim();
  if (raw) {
    headers.Authorization = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
  }
  return { headers };
}

function applyMcpRegionStyle(layer, layerRef) {
  const isDma = layerRef?.dataset === 'dma';
  const isDmaViewport = isDma && layerRef?.mode === 'viewport';
  if (!isDma) {
    const { fill, stroke } = resolveMcpRegionHexColors(
      layerRef ? { regionLayer: layerRef } : undefined
    );
    layer.setAttribute('fill-color', fill);
    layer.setAttribute('outline-color', stroke);
    layer.setAttribute('line-color', stroke);
  }
  if (theme === 'dark' && isDma && !isDmaViewport) {
    layer.setAttribute('dark-variant', '');
  }
  layer.setAttribute(
    'fill-opacity',
    String(isDmaViewport ? MCP_DMA_VIEWPORT_FILL_OPACITY : MCP_DMA_LAYER_FILL_OPACITY)
  );
  if (!isDmaViewport) {
    layer.setAttribute('line-width', String(MCP_DMA_LAYER_LINE_WIDTH));
  }
  layer.getRequestInit = cdnRequestInit;
}

function appendRegionLayer(layerRef) {
  if (!mapElement || !layerRef) return null;
  const layer = document.createElement('gk-layer');
  applyMcpRegionStyle(layer, layerRef);

  switch (layerRef.dataset) {
    case 'dma':
      layer.setAttribute('dataset', 'dma');
      if (layerRef.mode === 'viewport') {
        layer.setAttribute('mode', 'viewport');
      } else {
        layer.setAttribute('mode', 'slugs');
        layer.setAttribute('slugs', layerRef.slug);
        layer.setAttribute('highlight-slug', layerRef.slug);
        if (layerRef.region?.trim()) {
          layer.setAttribute('dma-region', layerRef.region.trim().toLowerCase());
        }
      }
      layer.setAttribute('interactive', '');
      break;
    case 'place':
      layer.setAttribute('dataset', 'place');
      layer.setAttribute('state', layerRef.state);
      layer.setAttribute('mode', 'slugs');
      layer.setAttribute('slugs', layerRef.slug);
      layer.setAttribute('highlight-slug', layerRef.slug);
      break;
    case 'state':
      layer.setAttribute('dataset', 'state');
      layer.setAttribute('mode', 'slugs');
      layer.setAttribute('slugs', layerRef.slug);
      break;
    case 'zip':
      layer.setAttribute('dataset', 'zip');
      layer.setAttribute('slugs', layerRef.slug);
      break;
    case 'county':
      layer.setAttribute('dataset', 'county');
      layer.setAttribute('mode', 'slugs');
      layer.setAttribute('slugs', layerRef.fips);
      break;
    default:
      return null;
  }

  mapElement.appendChild(layer);
  return layer;
}

async function fitHostBounds() {
  if (!mapElement || !shapeBounds || typeof mapElement.setBounds !== 'function') {
    return;
  }
  const padding = staticMapPaddingPx(
    { width: window.innerWidth, height: window.innerHeight },
    DEFAULT_MAP_FIT_PADDING
  );
  await mapElement.setBounds(shapeBounds, { padding });
}

function showCdnAuthBanner() {
  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.textContent =
    'DMA outlines need CDN auth — set GLOBE_CDN_JWT_SECRET in packages/geokit/.env and restart yarn map-host.';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    maxWidth: '90vw',
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#7f1d1d',
    color: '#fff',
    font: '14px/1.4 system-ui, sans-serif',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  });
  document.body.appendChild(banner);
}


async function waitForMapSettled() {
  const map = mapElement?.getMap?.();
  if (!map) {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return;
  }
  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      map.off?.('idle', done);
      map.off?.('moveend', done);
      resolve();
    };
    if (typeof map.isMoving === 'function' && !map.isMoving()) {
      requestAnimationFrame(() => requestAnimationFrame(done));
      return;
    }
    map.once?.('idle', done);
    map.once?.('moveend', done);
    setTimeout(done, 750);
  });
}

function waitForMapReady() {
  if (!mapElement) return Promise.resolve();
  if (mapElement.isInitialized) return Promise.resolve();
  return new Promise((resolve) => {
    mapElement.addEventListener('gk-map-ready', () => resolve(), { once: true });
  });
}

function waitForLayerReady(layer) {
  return new Promise((resolve) => {
    layer.addEventListener('gk-layer-ready', () => resolve(), { once: true });
  });
}

async function mountRegionLayerWhenReady() {
  if (!mapElement) return;

  await fetchCdnIdentityToken();
  if (!cachedCdnJwt && regionLayer) {
    console.warn(
      '[map-host] Globe CDN JWT unavailable — DMA outlines need yarn map-host and GLOBE_CDN_JWT_SECRET in packages/geokit/.env'
    );
    showCdnAuthBanner();
  }

  if (!mapElement.isInitialized && typeof mapElement.initializeMap === 'function') {
    void mapElement.initializeMap();
  }
  await waitForMapReady();

  if (shapeBounds) {
    await fitHostBounds();
    await waitForMapSettled();
  }

  if (!regionLayer) {
    return;
  }

  const regionLayerEl = appendRegionLayer(regionLayer);
  if (!regionLayerEl) {
    return;
  }

  regionLayerEl.getRequestInit = cdnRequestInit;

  const layerReady = waitForLayerReady(regionLayerEl);
  await regionLayerEl.reloadDataset();
  await layerReady;
}

void mountRegionLayerWhenReady();
