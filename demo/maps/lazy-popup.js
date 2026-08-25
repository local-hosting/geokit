import { setupMapsDemo } from '../shared/bootstrap-maps.js';
import {
  fadeOutPopup,
  getPopupModule,
  getPopupModuleSync,
  preloadPopupModule,
} from '../../packages/ui/src/lazy-popup.ts';

const mapElement = document.getElementById('lazy-popup-map');
const statusEl = document.getElementById('module-status');
const logEl = document.getElementById('log');

/** @type {HTMLElement | null} */
let activePopup = null;

function setStatus(text) {
  statusEl.textContent = `Popup module: ${text}`;
}

function log(message) {
  logEl.textContent = message;
  console.log('[gk-popup]', message);
}

function refreshStatus() {
  setStatus(getPopupModuleSync() ? 'loaded' : 'not loaded');
}

await setupMapsDemo({ elements: [] });

if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => preloadPopupModule(), { timeout: 1500 });
} else {
  setTimeout(() => preloadPopupModule(), 500);
}

getPopupModule()
  .then(() => {
    refreshStatus();
    log('Popup module loaded — click the map to open a popup.');
  })
  .catch((error) => {
    log(`Failed to load popup module: ${error}`);
  });

document.getElementById('preload').addEventListener('click', () => {
  preloadPopupModule();
  void getPopupModule().then(() => {
    refreshStatus();
    log('Preload requested — module ready.');
  });
});

document.getElementById('clear').addEventListener('click', () => {
  if (!activePopup) return;
  fadeOutPopup(activePopup, () => {
    activePopup?.remove?.();
    activePopup = null;
    log('Popup cleared.');
  });
});

mapElement?.addEventListener('gk-map-ready', () => {
  const map = mapElement.getMap?.();
  if (!map) return;

  map.on('click', async (event) => {
    if (!event.lngLat) return;
    await getPopupModule();
    refreshStatus();

    if (activePopup) {
      fadeOutPopup(activePopup, () => activePopup?.remove?.());
      activePopup = null;
    }

    const popup = document.createElement('gk-popup');
    popup.setAttribute('lat', String(event.lngLat.lat));
    popup.setAttribute('lng', String(event.lngLat.lng));
    popup.setAttribute(
      'content',
      `<h4>Lazy popup</h4><p>${event.lngLat.lat.toFixed(4)}, ${event.lngLat.lng.toFixed(4)}</p>`
    );
    popup.setAttribute('close-button', 'true');
    mapElement.appendChild(popup);
    activePopup = popup;
    log(`Opened popup at ${event.lngLat.lat.toFixed(4)}, ${event.lngLat.lng.toFixed(4)}`);
  });
});
