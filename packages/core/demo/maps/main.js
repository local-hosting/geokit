// Main map demo — isochrone, point, popup, theme toggle.
import { scheduleMapboxApiInit, setupMapsDemo } from '../shared/bootstrap-maps.js';

const { mapboxToken } = await setupMapsDemo({
  elements: ['point', 'popup', 'isochrone'],
});
scheduleMapboxApiInit(mapboxToken);

const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle?.querySelector('.theme-icon');
const mapElement = document.getElementById('demo-map');

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
    const newTheme = mapElement.toggleTheme();
    updateThemeUI(newTheme);
  }
});

mapElement?.addEventListener('gk-theme-change', (event) => {
  const { themeName } = event.detail;
  updateThemeUI(themeName);
});
