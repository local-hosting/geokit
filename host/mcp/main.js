/** Interactive geokit host for open_map — query params drive viewport and provider. */
import '@geokit-src/ui/theme.css';
import { configure } from '@geokit-src/ui/providers/registry.ts';
import {
  defaultInteractiveMapStyle,
  resolveInteractiveMapCredentials,
} from '@geokit-src/mcp/resolve-map-provider-env.ts';

const params = new URLSearchParams(window.location.search);
const lat = Number(params.get('lat') ?? '39.8283');
const lng = Number(params.get('lng') ?? '-98.5795');
const zoom = Number(params.get('zoom') ?? '4');
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const providerHint = params.get('provider')?.trim() || undefined;

const browserEnv = {
  GEOKIT_MAP_PROVIDER: import.meta.env.GEOKIT_MAP_PROVIDER,
  MAP_PROVIDER: import.meta.env.MAP_PROVIDER,
  GEOKIT_MAP_API_KEY: import.meta.env.GEOKIT_MAP_API_KEY,
  MAP_API_KEY: import.meta.env.MAP_API_KEY,
  MAPTILER_KEY: import.meta.env.MAPTILER_KEY,
  GEOKIT_MAPTILER_KEY: import.meta.env.GEOKIT_MAPTILER_KEY,
  MAPBOX_TOKEN: import.meta.env.MAPBOX_TOKEN,
  MAPBOX_ACCESS_TOKEN: import.meta.env.MAPBOX_ACCESS_TOKEN,
  GEOKIT_MAPBOX_KEY: import.meta.env.GEOKIT_MAPBOX_KEY,
};

const { providerId, apiKey, maptilerApiKey, mapboxAccessToken } =
  resolveInteractiveMapCredentials(browserEnv, { providerHint });

if (!apiKey) {
  console.warn('[map-host] No map credentials — set GEOKIT_MAP_API_KEY in packages/geokit/.env');
}

configure({
  maptiler: { apiKey: maptilerApiKey },
  mapbox: { accessToken: mapboxAccessToken },
});

await import('@geokit-src/ui/core.ts');

const mapStyle = params.get('style')?.trim() || defaultInteractiveMapStyle(providerId);
const mapElement = document.getElementById('open-map');

if (mapElement) {
  mapElement.setAttribute('provider', providerId);
  mapElement.setAttribute('lat', String(lat));
  mapElement.setAttribute('lng', String(lng));
  mapElement.setAttribute('zoom', String(zoom));
  mapElement.setAttribute('theme', theme);
  mapElement.setAttribute('map-style', mapStyle);

  if (providerId === 'mapbox' && mapboxAccessToken) {
    mapElement.setAttribute('access-token', mapboxAccessToken);
  } else if (providerId === 'maptiler' && maptilerApiKey) {
    mapElement.setAttribute('api-key', maptilerApiKey);
  }
}
