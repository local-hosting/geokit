import { setupMapsDemo } from '../shared/bootstrap-maps.js';

await setupMapsDemo({ useFullUi: true });

let collection;

try {
  await customElements.whenDefined('gk-map-collection');
  collection = document.getElementById('map-collection');
} catch (error) {
  console.error('[Demo] Error loading:', error);
}

const totalMapsEl = document.getElementById('total-maps');
const activeMapsEl = document.getElementById('active-maps');
const availableMapsEl = document.getElementById('available-maps');
const activeMapsNamesEl = document.getElementById('active-maps-names');

function updateStats() {
  if (!collection) {
    console.warn('[Demo] Collection element not found');
    return;
  }

  if (!collection.getStats) {
    console.warn('[Demo] getStats method not available on collection');
    return;
  }

  try {
    const stats = collection.getStats();
    totalMapsEl.textContent = String(stats?.totalMaps ?? 0);
    activeMapsEl.textContent = String(stats?.inUse ?? 0);
    availableMapsEl.textContent = String(stats?.available ?? 0);

    if (activeMapsNamesEl) {
      const entries = collection.getActiveMapEntries?.();
      if (entries && entries.length > 0) {
        activeMapsNamesEl.innerHTML = entries
          .map(({ id, status }) =>
            `<span class="active-map-name" title="${id}: ${status}">
              <span class="active-map-status active-map-status--${status}" aria-label="${status}"></span>
              ${id}
            </span>`
          )
          .join('');
      } else {
        const names = collection.getActiveMapNames?.() ?? [];
        if (names.length === 0) {
          activeMapsNamesEl.textContent = 'None';
        } else {
          activeMapsNamesEl.innerHTML = names
            .map((name) => `<span class="active-map-name">${name}</span>`)
            .join('');
        }
      }
    }
  } catch (error) {
    console.error('[Demo] Error getting stats:', error);
    totalMapsEl.textContent = '?';
    activeMapsEl.textContent = '?';
    availableMapsEl.textContent = '?';
    if (activeMapsNamesEl) {
      activeMapsNamesEl.textContent = '?';
    }
  }
}

setInterval(updateStats, 500);

collection?.addEventListener('map-collection-ready', () => {
  updateStats();
});

document.addEventListener('map-moved-to-slot', () => {
  updateStats();
});

setTimeout(updateStats, 1000);
