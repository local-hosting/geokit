/**
 * Interactive geokit host for open_map / show_map — mirrors demo/maps bootstrap.
 */
import '@geokit-src/ui/theme.css';
import { configure, getUIProviderByName } from '@geokit-src/ui/providers/registry.ts';
import {
  MCP_DMA_LAYER_FILL_OPACITY,
  MCP_DMA_VIEWPORT_FILL_OPACITY,
  MCP_DMA_LAYER_LINE_WIDTH,
  resolveMcpMapTheme,
  resolveMcpRegionHexColors,
} from '@geokit-src/mcp/map-presentation.ts';
import { resolveInteractiveMapCredentials } from '@geokit-src/mcp/resolve-map-provider-env.ts';
import { parseMapHostBounds, parseMapHostPoints, parseMapHostRegionLayer } from '@geokit-src/mcp/open-map.ts';

const params = new URLSearchParams(window.location.search);
const lat = Number(params.get('lat') ?? '39.8283');
const lng = Number(params.get('lng') ?? '-98.5795');
const zoom = Number(params.get('zoom') ?? '4');
const theme = resolveMcpMapTheme(params.get('theme'));
const providerHint = params.get('provider')?.trim() || undefined;
const regionLayer = parseMapHostRegionLayer(params);
const shapeBounds = parseMapHostBounds(params.get('bounds'));
const hostPoints = parseMapHostPoints(params.get('points'));
if (params.get('points')?.trim() && hostPoints.length === 0) {
  console.error('[map-host] points query param present but failed to parse');
}
if (hostPoints.length) {
  console.log('[map-host] parsed listing points:', hostPoints.length);
}

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
  GEOKIT_MAP_STYLE_URL: import.meta.env.GEOKIT_MAP_STYLE_URL,
  MAP_STYLE_URL: import.meta.env.MAP_STYLE_URL,
  GEOKIT_TILE_API_URL: import.meta.env.GEOKIT_TILE_API_URL,
  TILE_API_URL: import.meta.env.TILE_API_URL,
  GEOKIT_TILE_CDN_URL: import.meta.env.GEOKIT_TILE_CDN_URL,
  TILE_CDN_URL: import.meta.env.TILE_CDN_URL,
};

const geoCdnBaseUrl =
  import.meta.env.GEOKIT_GEO_CDN_URL?.trim() ||
  import.meta.env.GEOKIT_GLOBE_CDN_URL?.trim() ||
  import.meta.env.GLOBE_CDN_URL?.trim() ||
  '';

const { providerId, apiKey, maptilerApiKey, mapboxAccessToken, styleUrl, tileTransform } =
  resolveInteractiveMapCredentials(browserEnv, { providerHint });

if (!apiKey) {
  console.warn('[map-host] No map credentials — set GEOKIT_MAP_API_KEY, MAPTILER_KEY, or MAPBOX_TOKEN');
}

configure({
  maptiler: {
    apiKey: maptilerApiKey,
    styleUrl,
    transformRequest: tileTransform,
  },
  mapbox: { accessToken: mapboxAccessToken },
});

const mapStyle =
  params.get('style')?.trim() ||
  styleUrl ||
  (providerId === 'mapbox' ? 'dark-v11' : 'dataviz-dark');
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

import { getZoomRadiusExpression } from '@geokit-src/ui/components/elements/point/point-style.ts';

await import('@geokit-src/ui/core.ts');
await import('@geokit-src/ui/components/elements/point/point.ts');
await import('@geokit-src/ui/components/elements/popup/popup-content.ts');
await import('@geokit-src/ui/components/elements/popup/popup-api.ts');
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
  if (geoCdnBaseUrl) {
    layer.setAttribute('cdn-base', geoCdnBaseUrl);
  }
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

function listingGeoJson() {
  return {
    type: 'FeatureCollection',
    features: hostPoints.map((point, index) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: {
        id: point.id ?? String(index + 1),
        name: point.name ?? point.id ?? `Listing ${index + 1}`,
        color: point.color ?? '#f97316',
        ...(point.url ? { url: point.url } : {}),
      },
    })),
  };
}

async function waitForMapStyleLoaded(map, timeoutMs = 10000) {
  if (!map) return;
  if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) return;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off?.('load', onLoad);
      map.off?.('style.load', onLoad);
      resolve();
    };
    const onLoad = () => {
      if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;
      finish();
    };
    map.once?.('load', onLoad);
    map.once?.('style.load', onLoad);
    setTimeout(finish, timeoutMs);
  });
}


const LISTING_SOURCE_ID = 'mcp-listings-source';
const LISTING_POINT_LAYER_ID = 'mcp-listings-point-layer';
const LISTING_POINT_SIZE = 2;

let activeListingPopup = null;
let listingSelectionLayers = null;

function listingPopupTitle(rawName) {
  if (!rawName) return '';
  const dash = rawName.indexOf(' - ');
  return (dash > 0 ? rawName.slice(0, dash) : rawName).trim();
}

function listingPointCoordinates(map, feature) {
  const props = feature?.properties ?? {};
  const featureId = props.id != null ? String(props.id) : '';
  if (featureId && map?.getSource?.(LISTING_SOURCE_ID)) {
    const source = map.getSource(LISTING_SOURCE_ID);
    const data = source?._data ?? source?._geojson ?? source?.data;
    const match = data?.features?.find((item) => String(item?.properties?.id ?? '') === featureId);
    const coords = match?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: Number(coords[0]), lat: Number(coords[1]) };
    }
  }
  const coords = feature?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    return { lng: Number(coords[0]), lat: Number(coords[1]) };
  }
  return null;
}

async function clearListingSelection(map) {
  if (!map || !listingSelectionLayers) return;
  const { clearSelectedVisual } = await import(
    '@geokit-src/ui/components/elements/point/point-selection.ts'
  );
  clearSelectedVisual(map, listingSelectionLayers);
  listingSelectionLayers = null;
}

async function applyListingSelection(map, feature, pointColor) {
  const coords = listingPointCoordinates(map, feature);
  if (!coords) return;
  const { applySelectedVisual } = await import(
    '@geokit-src/ui/components/elements/point/point-selection.ts'
  );
  await clearListingSelection(map);
  listingSelectionLayers = applySelectedVisual(
    map,
    LISTING_POINT_LAYER_ID,
    LISTING_SOURCE_ID,
    LISTING_POINT_SIZE,
    mapElement,
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
      properties: { ...(feature.properties ?? {}) },
    },
    { pointColor: pointColor ?? '#f97316', strokeWidth: 0 }
  );
}

async function installListingClickPopup(map) {
  const layerId = LISTING_POINT_LAYER_ID;
  if (!map?.getLayer?.(layerId) || map._mcpListingPopupBound) return;
  map._mcpListingPopupBound = true;

  const { showPointPopup } = await import('@geokit-src/ui/components/elements/popup/popup-api.ts');

  map.on('click', layerId, async (e) => {
    e.originalEvent?.stopPropagation?.();
    const feature = e.features?.[0];
    if (!feature?.geometry || !e.lngLat) return;
    const props = feature.properties ?? {};
    const url = typeof props.url === 'string' ? props.url.trim() : '';
    const title = listingPopupTitle(typeof props.name === 'string' ? props.name : '');
    if (!title && !url) return;

    const pointColor = typeof props.color === 'string' ? props.color : '#f97316';
    const anchor = listingPointCoordinates(map, feature) ?? e.lngLat;
    await applyListingSelection(map, feature, pointColor);

    const provider =
      getUIProviderByName(providerId) ??
      (typeof mapElement.getUIProvider === 'function' ? mapElement.getUIProvider() : null);
    activeListingPopup = showPointPopup(
      activeListingPopup,
      map,
      anchor,
      title,
      url ? { url } : {},
      provider,
    );
  });

  map.on('click', async (e) => {
    if (!e.point || !map.queryRenderedFeatures) return;
    let hits = [];
    try {
      hits = map.queryRenderedFeatures(e.point, { layers: [layerId] });
    } catch {
      return;
    }
    if (hits.length === 0) {
      await clearListingSelection(map);
      if (activeListingPopup) {
        activeListingPopup.remove?.();
        activeListingPopup = null;
      }
    }
  });

  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

function mountListingsDirect(map) {
  const sourceId = LISTING_SOURCE_ID;
  const pointLayerId = LISTING_POINT_LAYER_ID;
  const geojson = listingGeoJson();
  try {
    const existing = map.getSource?.(sourceId);
    if (existing?.setData) {
      existing.setData(geojson);
    } else if (!existing) {
      map.addSource(sourceId, { type: 'geojson', data: geojson, tolerance: 0, promoteId: 'id' });
    }
    if (!map.getLayer?.(pointLayerId)) {
      map.addLayer({
        id: pointLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': getZoomRadiusExpression(LISTING_POINT_SIZE),
          'circle-color': ['coalesce', ['get', 'color'], '#f97316'],
          'circle-opacity': 1,
          'circle-stroke-width': 0,
        },
      });
      if (typeof map.moveLayer === 'function') {
        try {
          map.moveLayer(pointLayerId);
        } catch {
          // Layer may already be on top
        }
      }
    }
    console.log('[map-host] direct listing layer mounted:', geojson.features.length, 'features');
    return true;
  } catch (error) {
    console.error('[map-host] direct listing layer failed:', error);
    return false;
  }
}

async function mountListingPointsWhenReady() {
  if (!hostPoints.length || !mapElement) return;

  await waitForMapReady();
  const map = mapElement.getMap?.();
  if (!map) {
    console.error('[map-host] map unavailable for listing markers');
    return;
  }

  await waitForMapStyleLoaded(map, 10000);

  for (const child of [...mapElement.querySelectorAll('gk-point, gk-point-layer')]) {
    child.remove();
  }

  await new Promise((resolve) => {
    if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
      return;
    }
    map.once?.('idle', resolve);
    setTimeout(resolve, 1500);
  });

  // Direct MapLibre layer — gk-point often reports success without visible layers in map-host.
  mountListingsDirect(map);
  await installListingClickPopup(map);
  console.log('[map-host] listing markers ready (direct layer):', hostPoints.length);
}


function showCdnAuthBanner() {
  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.textContent =
    'Boundary overlays need geo CDN auth — set GEOKIT_GEO_CDN_JWT_SECRET when your geo CDN requires a bearer token.';
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
  if (!mapElement || !regionLayer) return;

  if (!geoCdnBaseUrl) {
    console.warn('[map-host] GEOKIT_GEO_CDN_URL is not set — skipping boundary overlay');
    await waitForMapReady();
    await mountListingPointsWhenReady();
    return;
  }

  await fetchCdnIdentityToken();
  if (!cachedCdnJwt) {
    console.warn(
      '[map-host] Geo CDN JWT unavailable — set GEOKIT_GEO_CDN_JWT_SECRET when your geo CDN requires auth'
    );
    showCdnAuthBanner();
  }

  if (!mapElement.isInitialized && typeof mapElement.initializeMap === 'function') {
    void mapElement.initializeMap();
  }
  await waitForMapReady();

  await mountListingPointsWhenReady();

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
