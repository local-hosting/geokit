import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from 'h3-js';
import { registerMapTilerPlugin } from '../../packages/plugin-maptiler/src/index.ts';
import { getProviderForCapability } from '../../packages/api/src/providers/registry.ts';

const H3_SOURCE_ID = 'protomap-h3-source';
const H3_LAYER_ID = 'protomap-h3-fill';
const H3_RING = 2;
const DEFAULT_LAT = 39.8283;
const DEFAULT_LNG = -98.5795;
const DEFAULT_ZOOM = 4;

const mapElement = document.getElementById('protomap-map');
const markerElement = document.getElementById('protomap-marker');
const statusEl = document.getElementById('protomap-status');
const searchPanel = document.getElementById('protomap-search-panel');
const searchResults = document.getElementById('protomap-search-results');
const inlineSearch = document.getElementById('protomap-inline-search');
const launchbar = document.getElementById('protomap-launchbar');

/** @type {{ lat: number, lng: number, h3: string, color: string } | null} */
let pinState = null;
let mapMoveSyncTimer = null;

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function limitNumberWithinRange(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundMapValue(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseHashParams() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return {};
  /** @type {Record<string, string>} */
  const params = {};
  for (const segment of raw.split('&')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    const key = segment.slice(0, eq);
    const value = segment.slice(eq + 1);
    if (key) params[key] = value;
  }
  return params;
}

function buildHashFromParams(params) {
  const pairs = Object.keys(params)
    .filter((key) => key)
    .map((key) => `${key}=${params[key]}`);
  return pairs.length ? `#${pairs.join('&')}` : '';
}

function mergeHashParams(updates, { replace = true } = {}) {
  const params = parseHashParams();
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) delete params[key];
    else params[key] = value;
  }
  const hash = buildHashFromParams(params);
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (replace) history.replaceState(history.state, '', url);
  else window.location.hash = hash;
}

function parseMapParam(mapPart) {
  if (!mapPart) return null;
  const clean = mapPart.split('&')[0];
  const parts = clean.split('/');
  if (parts.length < 3) return null;
  const zoom = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  const lng = parseFloat(parts[2]);
  const pitch = parts.length > 3 ? parseFloat(parts[3]) : 0;
  const bearing = parts.length > 4 ? parseFloat(parts[4]) : 0;
  if ([zoom, lat, lng, pitch, bearing].some((n) => Number.isNaN(n))) return null;
  return { zoom, lat, lng, pitch, bearing };
}

function buildMapParam(zoom, lat, lng, pitch = 0, bearing = 0) {
  let value = `${roundMapValue(zoom, 2)}/${roundMapValue(lat, 5)}/${roundMapValue(lng, 5)}`;
  if (pitch !== 0 || bearing !== 0) {
    value += `/${roundMapValue(pitch, 1)}/${roundMapValue(bearing, 1)}`;
  }
  return value;
}

function colorFromH3(_h3) {
  return '#000000';
}

function resolutionFromZoom(zoom) {
  return limitNumberWithinRange(Math.floor(zoom * (16 / 23)), 6, 15);
}

function readInitialPin() {
  const params = parseHashParams();
  const markerParam = params.marker;
  const h3Param = params.h3;
  const mapState = parseMapParam(params.map);

  if (markerParam) {
    const [latRaw, lngRaw] = markerParam.split(',');
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const zoom = mapState?.zoom ?? DEFAULT_ZOOM;
      const h3 = h3Param || latLngToCell(lat, lng, resolutionFromZoom(zoom));
      return { lat, lng, h3, color: colorFromH3(h3) };
    }
  }

  if (h3Param) {
    const [lat, lng] = cellToLatLng(h3Param);
    return { lat, lng, h3: h3Param, color: colorFromH3(h3Param) };
  }

  if (mapState) {
    const h3 = latLngToCell(mapState.lat, mapState.lng, resolutionFromZoom(mapState.zoom));
    return {
      lat: mapState.lat,
      lng: mapState.lng,
      h3,
      color: colorFromH3(h3),
    };
  }

  const h3 = latLngToCell(DEFAULT_LAT, DEFAULT_LNG, resolutionFromZoom(DEFAULT_ZOOM));
  return { lat: DEFAULT_LAT, lng: DEFAULT_LNG, h3, color: colorFromH3(h3) };
}

function applyPinToMarker() {
  if (!pinState || !markerElement) return;
  markerElement.setAttribute('lat', String(pinState.lat));
  markerElement.setAttribute('lng', String(pinState.lng));
  markerElement.setAttribute('color', pinState.color);
}

function syncPinHash({ includeMapFromView = false } = {}) {
  if (!pinState) return;
  const updates = {
    h3: pinState.h3,
    marker: `${Number(pinState.lat).toFixed(6)},${Number(pinState.lng).toFixed(6)}`,
  };

  if (includeMapFromView) {
    const map = mapElement?.getMap?.();
    if (map) {
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();
      const pitch = map.getPitch?.() ?? 0;
      const bearing = map.getBearing?.() ?? 0;
      if (center && zoom !== undefined) {
        updates.map = buildMapParam(zoom, center.lat, center.lng, pitch, bearing);
      }
    }
  } else {
    const existing = parseHashParams().map;
    if (existing) updates.map = existing;
  }

  mergeHashParams(updates);
}

function h3CellsFeatureCollection(h3, color) {
  const cells = gridDisk(h3, H3_RING);
  const features = cells.map((cell) => {
    const ring = cellToBoundary(cell, true);
    const isCenter = cell === h3;
    return {
      type: 'Feature',
      id: cell,
      properties: { h3: cell, isCenter, fillColor: color },
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
    properties: { fillColor: color },
  };
}

function ensureH3Layers(map) {
  if (!map.isStyleLoaded?.()) return false;
  if (!map.getSource(H3_SOURCE_ID)) {
    map.addSource(H3_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(H3_LAYER_ID)) {
    map.addLayer({
      id: H3_LAYER_ID,
      type: 'fill',
      source: H3_SOURCE_ID,
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': ['case', ['boolean', ['get', 'isCenter'], false], 0.35, 0.18],
        'fill-antialias': false,
      },
    });
  }
  return true;
}

function refreshH3Layer() {
  const map = mapElement?.getMap?.();
  if (!map || !pinState) return;
  if (!map.isStyleLoaded?.()) {
    map.once?.('load', () => refreshH3Layer());
    return;
  }
  if (!ensureH3Layers(map)) return;
  const collection = h3CellsFeatureCollection(pinState.h3, pinState.color);
  map.getSource(H3_SOURCE_ID)?.setData?.(collection);
}

function updatePinFromLatLng(lat, lng, { syncHash = true, includeMap = false } = {}) {
  const map = mapElement?.getMap?.();
  const zoom = map?.getZoom?.() ?? DEFAULT_ZOOM;
  const h3 = latLngToCell(lat, lng, resolutionFromZoom(zoom));
  pinState = { lat, lng, h3, color: colorFromH3(h3) };
  applyPinToMarker();
  refreshH3Layer();
  if (syncHash) syncPinHash({ includeMapFromView: includeMap });
  setStatus(`H3 ${pinState.h3}`);
}

function bindMapUrlSync(map) {
  const handler = () => {
    if (mapMoveSyncTimer) clearTimeout(mapMoveSyncTimer);
    mapMoveSyncTimer = setTimeout(() => {
      mapMoveSyncTimer = null;
      syncPinHash({ includeMapFromView: true });
    }, 300);
  };
  map.on('moveend', handler);
}

function getPinView() {
  const map = mapElement?.getMap?.();
  const zoom = map?.getZoom?.() ?? DEFAULT_ZOOM;
  return {
    lat: pinState?.lat ?? DEFAULT_LAT,
    lng: pinState?.lng ?? DEFAULT_LNG,
    zoom,
  };
}

function openLaunchUrl(kind) {
  const { lat, lng, zoom } = getPinView();
  const latFixed = Number(lat).toFixed(6);
  const lngFixed = Number(lng).toFixed(6);
  const zoomFixed = Math.round(zoom);
  let url = '';
  switch (kind) {
    case 'apple':
      url = `https://maps.apple.com/?q=${latFixed},${lngFixed}+Location&ll=${latFixed},${lngFixed}&z=${zoomFixed}`;
      break;
    case 'google':
      url = `https://www.google.com/maps/place/${latFixed},${lngFixed}/@${latFixed},${lngFixed},${zoomFixed}z`;
      break;
    case 'osm':
      url = `https://www.openstreetmap.org/?mlat=${latFixed}&mlon=${lngFixed}#map=${zoomFixed}/${latFixed}/${lngFixed}`;
      break;
    case 'waze':
      url = `https://www.waze.com/live-map/directions?to=ll.${latFixed}%2C${lngFixed}`;
      break;
    default:
      return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function flashButton(button) {
  if (!button) return;
  button.classList.add('success');
  setTimeout(() => button.classList.remove('success'), 1200);
}

function bindThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');

  function updateThemeUI(themeName) {
    const invert = themeName === 'dark';
    document.body.classList.toggle('bk-invert', invert);
    document.body.classList.toggle('light-theme', !invert);
    if (themeIcon) themeIcon.textContent = invert ? 'WHT' : 'INV';
  }

  const initialTheme = mapElement?.getAttribute('theme') || 'light';
  updateThemeUI(initialTheme);

  themeToggle?.addEventListener('click', () => {
    if (mapElement && typeof mapElement.toggleTheme === 'function') {
      updateThemeUI(mapElement.toggleTheme());
    }
  });

  mapElement?.addEventListener('gk-theme-change', (event) => {
    const { themeName } = event.detail ?? {};
    if (themeName) updateThemeUI(themeName);
  });
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    flashButton(button);
    setStatus('Copied to clipboard');
  } catch {
    setStatus('Clipboard unavailable');
  }
}

function hideSearchResults() {
  searchPanel.hidden = true;
  searchResults.innerHTML = '';
}

function showSearchResults() {
  searchPanel.hidden = false;
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

function geocodeFeatureLabel(feature) {
  const props = feature.properties ?? {};
  return (
    feature.place_name ||
    feature.text ||
    props.place_name ||
    props.label ||
    props.name ||
    'Unknown location'
  );
}

async function runGeocode(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    hideSearchResults();
    return;
  }

  const provider = getProviderForCapability('geocoding');
  if (!provider?.geocode) {
    setStatus('Geocoding unavailable — set MAPTILER_KEY');
    return;
  }

  const { lat, lng } = getPinView();
  try {
    const result = await provider.geocode({
      query: trimmed,
      limit: 5,
      proximity: [lng, lat],
    });
    const features = result?.features ?? [];
    searchResults.innerHTML = '';
    if (features.length === 0) {
      showSearchResults();
      const li = document.createElement('li');
      li.textContent = 'No results';
      searchResults.appendChild(li);
      return;
    }

    showSearchResults();
    for (const feature of features.slice(0, 5)) {
      const li = document.createElement('li');
      const label = geocodeFeatureLabel(feature);
      li.textContent = label;
      li.addEventListener('click', () => {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) return;
        const [featureLng, featureLat] = coords;
        mapElement.flyTo(featureLat, featureLng, 14);
        updatePinFromLatLng(featureLat, featureLng, { includeMap: true });
        inlineSearch.value = label;
        hideSearchResults();
      });
      searchResults.appendChild(li);
    }
  } catch (error) {
    console.warn('[protomap] geocode failed', error);
    setStatus('Search failed');
  }
}

const debouncedGeocode = debounce(runGeocode, 350);

function bindUi() {
  inlineSearch?.addEventListener('input', (e) => {
    debouncedGeocode(e.target.value);
  });

  inlineSearch?.addEventListener('focus', () => {
    if (searchResults.children.length > 0) showSearchResults();
  });

  document.getElementById('protomap-route-btn')?.addEventListener('click', () => {
    launchbar.hidden = false;
  });

  document.getElementById('protomap-launch-close')?.addEventListener('click', () => {
    launchbar.hidden = true;
  });

  launchbar?.querySelectorAll('[data-launch]').forEach((button) => {
    button.addEventListener('click', () => {
      openLaunchUrl(button.getAttribute('data-launch'));
      launchbar.hidden = true;
    });
  });

  document.getElementById('protomap-map-btn')?.addEventListener('click', () => {
    if (!pinState) return;
    mapElement.flyTo(pinState.lat, pinState.lng, mapElement.getMap?.()?.getZoom?.() ?? DEFAULT_ZOOM);
  });

  document.getElementById('protomap-share-btn')?.addEventListener('click', () => {
    syncPinHash({ includeMapFromView: true });
    copyText(window.location.href, document.getElementById('protomap-share-btn'));
  });

  document.getElementById('protomap-h3-btn')?.addEventListener('click', () => {
    if (!pinState) return;
    copyText(pinState.h3, document.getElementById('protomap-h3-btn'));
  });

  markerElement?.addEventListener('marker-dragend', (event) => {
    const { lat, lng } = event.detail ?? {};
    if (lat === undefined || lng === undefined) return;
    updatePinFromLatLng(lat, lng, { includeMap: false });
  });

  window.addEventListener('hashchange', () => {
    pinState = readInitialPin();
    applyPinToMarker();
    refreshH3Layer();
    const mapState = parseMapParam(parseHashParams().map);
    if (mapState) {
      mapElement.flyTo(mapState.lat, mapState.lng, mapState.zoom);
    }
  });
}

function applyInitialMapView() {
  const mapState = parseMapParam(parseHashParams().map);
  if (!mapState) return;
  mapElement.setAttribute('lat', String(mapState.lat));
  mapElement.setAttribute('lng', String(mapState.lng));
  mapElement.setAttribute('zoom', String(mapState.zoom));
}

function onMapReady() {
  const map = mapElement?.getMap?.();
  if (!map) return;

  if (!pinState) {
    pinState = readInitialPin();
    applyPinToMarker();
  }
  ensureH3Layers(map);
  refreshH3Layer();
  bindMapUrlSync(map);

  if (!parseHashParams().map) {
    syncPinHash({ includeMapFromView: true });
  }

  map.on('style.load', () => {
    ensureH3Layers(map);
    refreshH3Layer();
  });
}

pinState = readInitialPin();
applyPinToMarker();
applyInitialMapView();

const { maptilerKey } = await setupMapsDemo({
  elements: ['marker', 'navigation-control'],
});

if (maptilerKey) {
  await registerMapTilerPlugin({ maptilerApiKey: maptilerKey });
} else {
  setStatus('MAPTILER_KEY missing — basemap and search need a key');
}

bindUi();
bindThemeToggle();

mapElement?.addEventListener('gk-map-ready', onMapReady);

const existingMap = mapElement?.getMap?.();
if (existingMap?.isStyleLoaded?.()) {
  onMapReady();
} else if (existingMap) {
  existingMap.once('load', () => onMapReady());
}
