import maplibregl from 'maplibre-gl';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from '../../src/ui/src/utils/geojson-source-options.ts';
import { bboxToPolygonGeometry } from '../../src/core/src/utils/bounds/bbox-to-polygon.ts';

/** @param {{ maptilerKey?: string, center?: [number, number], zoom?: number }} [options] */
export function createMap(container, options = {}) {
  const { maptilerKey = import.meta.env.MAPTILER_KEY, center = [-98.5, 39.8], zoom = 3.5 } = options;
  if (!maptilerKey) {
    console.warn('[gk-demo] MAPTILER_KEY missing — set MAPTILER_KEY in geokit .env');
  }
  const style = maptilerKey
    ? `https://api.maptiler.com/maps/basic-v2-light/style.json?key=${maptilerKey}`
    : 'https://demotiles.maplibre.org/style.json';

  const map = new maplibregl.Map({
    container,
    style,
    center,
    zoom,
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  return map;
}

/** @param {import('maplibre-gl').Map} map */
export function fitBounds(map, bounds) {
  if (!map?.fitBounds) return;
  if (!bounds || bounds.length !== 4) return;
  map.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    {
      padding: 56,
      duration: 700,
      maxZoom: 14,
    }
  );
}

/** @param {import('maplibre-gl').Map} map */
export function setGeoJsonOutline(map, sourceId, geojson) {
  if (!map?.getSource) return;
  const data =
    geojson?.type === 'FeatureCollection'
      ? geojson
      : { type: 'FeatureCollection', features: [geojson] };
  const lineColor =
    getComputedStyle(document.documentElement).getPropertyValue('--bk-map-line').trim() || '#000';

  const existing = map.getSource(sourceId);
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, { type: 'geojson', data, ...BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS });
  map.addLayer({
    id: `${sourceId}-line`,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': lineColor,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1, 12, 1.5],
      'line-opacity': 0.65,
    },
  });
  map.addLayer({
    id: `${sourceId}-fill`,
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': lineColor, 'fill-opacity': 0.04 },
  });
}

/** @param {import('maplibre-gl').Map} map */
export function setBoundsOverlay(map, sourceId, bounds) {
  if (!map?.getSource) return;
  if (!bounds || bounds.length !== 4) return;
  const lineColor =
    getComputedStyle(document.documentElement).getPropertyValue('--bk-map-line').trim() || '#000';
  const data = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: bboxToPolygonGeometry(bounds) }],
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
    paint: { 'line-color': lineColor, 'line-width': 2, 'line-dasharray': [3, 2] },
  });
}

/**
 * @param {HTMLElement} mapEl
 * @param {(map: import('maplibre-gl').Map) => void | Promise<void>} [run]
 */
export function wireMapDemo(mapEl, run) {
  const map = createMap(mapEl);
  const ready = new Promise((resolve) => {
    const finish = () => resolve(map);
    if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      finish();
      return;
    }
    map.once('load', finish);
  });
  if (run) void ready.then((loadedMap) => run(loadedMap));
  return ready;
}
