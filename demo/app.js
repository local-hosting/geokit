// geokit Demo App
import { configure } from '../src/ui/index.ts';

// Configure API keys globally - do this once at app startup
configure({
  maptiler: { 
    apiKey: import.meta.env.MAPTILER_API_KEY 
  },
  mapbox: { 
    accessToken: import.meta.env.MAPBOX_ACCESS_TOKEN 
  }
});

