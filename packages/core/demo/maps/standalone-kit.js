import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { registerLayerDatasetMount } from '../../src/utils/geojson-loader/registry.ts';
import { paintColorFromProperty, SHARED_POINT_UNIFORM_GLOW_OPACITY } from '../../src/ui/utils/shared-point-paint.ts';

const TERRITORY_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'North', _color: '#6366f1' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-104, 38], [-95, 38], [-95, 45], [-104, 45], [-104, 38]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'South', _color: '#22c55e' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-104, 30], [-95, 30], [-95, 37], [-104, 37], [-104, 30]]],
      },
    },
  ],
};

const POINT_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'a', properties: { _color: '#f97316' }, geometry: { type: 'Point', coordinates: [-100, 42] } },
    { type: 'Feature', id: 'b', properties: { _color: '#06b6d4' }, geometry: { type: 'Point', coordinates: [-98, 34] } },
    { type: 'Feature', id: 'c', properties: { _color: '#ec4899' }, geometry: { type: 'Point', coordinates: [-101, 36] } },
  ],
};

registerLayerDatasetMount('territory', async ({ map, options }) => {
  const sourceId = 'gk-dataset-territory';
  const layerId = 'gk-dataset-territory-fill';
  const outlineId = 'gk-dataset-territory-outline';

  map.addSource?.(sourceId, { type: 'geojson', data: TERRITORY_GEOJSON });
  map.addLayer?.({
    id: layerId,
    type: 'fill',
    source: sourceId,
    paint: {
      'fill-color': options.fillColor ?? ['coalesce', ['get', '_color'], '#6366f1'],
      'fill-opacity': options.fillOpacity ?? 0.4,
    },
  });
  map.addLayer?.({
    id: outlineId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': options.outlineColor ?? '#ffffff',
      'line-width': 1,
      'line-opacity': 0.35,
    },
  });

  return {
    sourceId,
    layerId,
    hitLayerIds: [layerId, outlineId],
    cleanup: () => {
      map.removeLayer?.(outlineId);
      map.removeLayer?.(layerId);
      map.removeSource?.(sourceId);
    },
  };
});

await setupMapsDemo({ elements: ['layer', 'point-layer'] });

const mapEl = document.getElementById('standalone-map');
mapEl.addEventListener('gk-map-ready', () => {
  const pointLayer = mapEl.querySelector('gk-point-layer');
  if (!pointLayer) return;
  pointLayer.setData(POINT_GEOJSON);
  pointLayer.setGlowPaintProperty('circle-color', paintColorFromProperty());
  pointLayer.setGlowPaintProperty('circle-opacity', SHARED_POINT_UNIFORM_GLOW_OPACITY);
  pointLayer.setPointPaintProperty('circle-color', paintColorFromProperty());
  pointLayer.setPointPaintProperty('circle-radius', [
    'interpolate', ['linear'], ['zoom'], 0, 3, 6, 4, 10, 6,
  ]);
});
