// geokit Demo App
import { configure } from '../src/ui/index.ts';
import { registerAPIProvider, initAPIProvider, MapboxAPIProvider } from '../src/api/index.ts';

// Configure API keys globally - do this once at app startup
configure({
  maptiler: { 
    apiKey: import.meta.env.MAPTILER_API_KEY 
  },
  mapbox: { 
    accessToken: import.meta.env.MAPBOX_ACCESS_TOKEN 
  }
});

// Register Mapbox API provider for isochrones
const mapboxToken = import.meta.env.MAPBOX_ACCESS_TOKEN;
if (mapboxToken) {
  try {
    registerAPIProvider('mapbox', new MapboxAPIProvider());
    await initAPIProvider('mapbox', { accessToken: mapboxToken });
    console.log('[Demo] Mapbox API provider registered for isochrones');
  } catch (error) {
    console.warn('[Demo] Failed to register Mapbox API provider:', error);
  }
} else {
  console.warn('[Demo] No Mapbox token found. Isochrones will not work. Set MAPBOX_ACCESS_TOKEN environment variable.');
}

