// Shared-point selection demos: click ring, events, setSelectedPoint, gk-point focus.
import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import { createSharedPointLayers } from '../../src/ui/utils/layer-styles.ts';

await setupMapsDemo({ elements: ['point'] });

const SOURCE_ID = 'demo-venues';
const mapElement = document.getElementById('selection-map');
const stateEl = document.getElementById('selection-state');
const logEl = document.getElementById('event-log');
const declarativePoint = document.getElementById('declarative-point');

/** @param {string} message @param {'info'|'selected'|'click'|'point'} [kind] */
function logEvent(message, kind = 'info') {
  const line = document.createElement('div');
  line.className = `evt evt-${kind}`;
  const time = new Date().toLocaleTimeString([], { hour12: false });
  line.textContent = `[${time}] ${message}`;
  logEl.prepend(line);
  while (logEl.children.length > 40) {
    logEl.lastElementChild?.remove();
  }
}

function formatSelection() {
  const selected = mapElement.getSelectedPoint?.(SOURCE_ID);
  if (!selected) {
    stateEl.textContent = 'No selection (shared layer)';
    return;
  }
  const { featureId, lngLat } = selected;
  stateEl.textContent = `${featureId} @ ${lngLat.lng.toFixed(4)}, ${lngLat.lat.toFixed(4)}`;
}

const testVenues = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { slug: 'venue-1', name: 'Los Angeles', type: 'default' },
      geometry: { type: 'Point', coordinates: [-118.2437, 34.0522] },
    },
    {
      type: 'Feature',
      properties: { slug: 'venue-2', name: 'Phoenix', type: 'premium' },
      geometry: { type: 'Point', coordinates: [-112.074, 33.4484] },
    },
    {
      type: 'Feature',
      properties: { slug: 'venue-3', name: 'Denver', type: 'partner' },
      geometry: { type: 'Point', coordinates: [-104.9903, 39.7392] },
    },
    {
      type: 'Feature',
      properties: { slug: 'venue-4', name: 'Chicago', type: 'default' },
      geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
    },
    {
      type: 'Feature',
      properties: { slug: 'venue-5', name: 'New York', type: 'default' },
      geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
    },
  ],
};

mapElement.addEventListener('gk-map-ready', () => {
  const map = mapElement.getMap();
  if (!map) {
    logEvent('gk-map-ready but no map instance', 'info');
    return;
  }

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: testVenues,
    promoteId: 'slug',
  });

  createSharedPointLayers({
    map,
    sourceId: SOURCE_ID,
    glowLayerId: 'demo-venue-glow',
    pointLayerId: 'demo-venue-points',
    circleColor: [
      'match',
      ['get', 'type'],
      'premium',
      '#02cb56',
      'partner',
      '#1a73e8',
      '#ff6b35',
    ],
    glowOpacity: 0.45,
    selectionRingColor: '#ffffff',
  });

  logEvent('Shared venue layers ready — click a dot', 'info');
  formatSelection();
});

mapElement.addEventListener('gk-shared-point-selected', (e) => {
  const { sourceId, featureId, previousFeatureId, lngLat } = e.detail;
  logEvent(
    `gk-shared-point-selected ${previousFeatureId ?? '∅'} → ${featureId ?? '∅'} (${sourceId})`,
    'selected'
  );
  if (lngLat) {
    logEvent(`  ring @ ${lngLat.lng.toFixed(4)}, ${lngLat.lat.toFixed(4)}`, 'selected');
  }
  formatSelection();
});

mapElement.addEventListener('gk-point-click', (e) => {
  const { featureId, sourceId, features } = e.detail;
  const name = features?.[0]?.properties?.name ?? featureId ?? '?';
  logEvent(`gk-point-click "${name}" featureId=${featureId ?? '∅'} (${sourceId})`, 'click');
});

mapElement.addEventListener('gk-point-focus', (e) => {
  const { pointId, title } = e.detail;
  logEvent(`gk-point-focus ${pointId} (${title ?? 'no title'})`, 'point');
});

mapElement.addEventListener('gk-point-blur', () => {
  logEvent('gk-point-blur', 'point');
});

document.querySelectorAll('[data-select]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const featureId = btn.getAttribute('data-select');
    if (!featureId) return;
    const ok = mapElement.setSelectedPoint(SOURCE_ID, featureId);
    logEvent(`setSelectedPoint("${featureId}") → ${ok ? 'ok' : 'failed'}`, 'info');
    formatSelection();
  });
});

document.getElementById('btn-clear')?.addEventListener('click', () => {
  mapElement.clearSelectedPoint(SOURCE_ID);
  logEvent('clearSelectedPoint()', 'info');
  formatSelection();
});

document.getElementById('btn-read')?.addEventListener('click', () => {
  const selected = mapElement.getSelectedPoint(SOURCE_ID);
  logEvent(`getSelectedPoint → ${JSON.stringify(selected)}`, 'info');
  formatSelection();
});

document.getElementById('btn-focus-point')?.addEventListener('click', () => {
  declarativePoint?.focus?.();
});

document.getElementById('btn-blur-point')?.addEventListener('click', () => {
  declarativePoint?.blur?.();
});

document.getElementById('btn-clear-log')?.addEventListener('click', () => {
  logEl.innerHTML = '';
});

logEvent('Waiting for gk-map-ready…', 'info');
