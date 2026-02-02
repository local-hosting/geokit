// geokit Demo App
// Map view state (zoom, center, pitch, bearing) is preserved in the URL hash (#map=zoom/lat/lng[/pitch][/bearing])
// when the map has the sync-url attribute. Pan/zoom the map and refresh or use browser back/forward to restore.
import '../src/ui/theme.css';
import { configure } from '../src/ui/index.ts';
import { registerAPIProvider, initAPIProvider, MapboxAPIProvider } from '../src/api/index.ts';

// Configure API keys globally - do this once at app startup
configure({
  maptiler: { 
    apiKey: import.meta.env.MAPTILER_KEY 
  },
  mapbox: { 
    accessToken: import.meta.env.MAPBOX_TOKEN 
  }
});

// Register Mapbox API provider for isochrones
const mapboxToken = import.meta.env.MAPBOX_TOKEN;
if (mapboxToken) {
  try {
    registerAPIProvider('mapbox', new MapboxAPIProvider());
    await initAPIProvider('mapbox', { accessToken: mapboxToken });
  } catch (error) {
    console.warn('[Demo] Failed to register Mapbox API provider:', error);
  }
} else {
  console.warn('[Demo] No Mapbox token found. Isochrones will not work. Set MAPBOX_TOKEN environment variable.');
}

// ============================================================================
// Theme Toggle
// ============================================================================

const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle?.querySelector('.theme-icon');
const mapElement = document.getElementById('demo-map');

function updateThemeUI(themeName) {
  if (themeName === 'light') {
    document.body.classList.add('light-theme');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if (themeIcon) themeIcon.textContent = '🌙';
  }
}

// Initialize theme UI based on attribute
const initialTheme = mapElement?.getAttribute('theme') || 'dark';
updateThemeUI(initialTheme);

// Listen for theme toggle click
themeToggle?.addEventListener('click', () => {
  if (mapElement && typeof mapElement.toggleTheme === 'function') {
    const newTheme = mapElement.toggleTheme();
    updateThemeUI(newTheme);
  }
});

// Listen for theme change events from the map
mapElement?.addEventListener('gk-theme-change', (event) => {
  const { themeName } = event.detail;
  updateThemeUI(themeName);
});

