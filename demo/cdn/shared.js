import maplibregl from 'maplibre-gl';

import { resolveGlobeCdnBaseUrl } from '../../src/cdn/config.ts';
import { bboxToPolygonGeometry } from '../../src/utils/bounds/bbox-to-polygon.ts';

export function getCdnOptions() {
  return { baseUrl: resolveGlobeCdnBaseUrl() };
}

export function cdnBaseLabel() {
  return resolveGlobeCdnBaseUrl();
}

export function createMap(container) {
  const key = import.meta.env.MAPTILER_KEY;
  if (!key) {
    console.warn('[cdn-demo] MAPTILER_KEY missing — set packages/geokit/.env');
  }
  const style = key
    ? `https://api.maptiler.com/maps/basic-v2-light/style.json?key=${key}`
    : 'https://demotiles.maplibre.org/style.json';

  const map = new maplibregl.Map({
    container,
    style,
    center: [-98.5, 39.8],
    zoom: 3.5,
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  return map;
}

export function fitBounds(map, bounds) {
  if (!bounds || bounds.length !== 4) return;
  map.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { padding: 56, duration: 700, maxZoom: 14 }
  );
}

export function setGeoJsonOutline(map, sourceId, geojson) {
  const data =
    geojson?.type === 'FeatureCollection'
      ? geojson
      : { type: 'FeatureCollection', features: [geojson] };

  const existing = map.getSource(sourceId);
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, { type: 'geojson', data });
  map.addLayer({
    id: `${sourceId}-line`,
    type: 'line',
    source: sourceId,
    paint: { 'line-color': getComputedStyle(document.documentElement).getPropertyValue('--bk-map-line').trim() || '#000', 'line-width': 2 },
  });
  map.addLayer({
    id: `${sourceId}-fill`,
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': getComputedStyle(document.documentElement).getPropertyValue('--bk-map-line').trim() || '#000', 'fill-opacity': 0.05 },
  });
}

/** Dashed rectangle for [minLon, minLat, maxLon, maxLat] bounds overlay. */
export function setBoundsOverlay(map, sourceId, bounds) {
  if (!bounds || bounds.length !== 4) return;

  const lineColor =
    getComputedStyle(document.documentElement).getPropertyValue('--bk-map-line').trim() || '#000';
  const data = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: bboxToPolygonGeometry(bounds),
      },
    ],
  };

  const existing = map.getSource(sourceId);
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, { type: 'geojson', data });
  map.addLayer({
    id: `${sourceId}-line`,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': lineColor,
      'line-width': 2,
      'line-dasharray': [3, 2],
    },
  });
}

export function appendLog(logEl, message, data) {
  const time = new Date().toISOString().slice(11, 19);
  const line =
    data === undefined
      ? `[${time}] ${message}`
      : `[${time}] ${message}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`;
  logEl.textContent = logEl.textContent ? `${logEl.textContent}\n\n${line}` : line;
  logEl.scrollTop = logEl.scrollHeight;
}

export { mountDemoNav, renderDemoNav } from '../shared/nav.js';

export function wireMapDemo(mapEl, run) {
  const map = createMap(mapEl);
  map.on('load', () => {
    void run(map);
  });
  return map;
}
