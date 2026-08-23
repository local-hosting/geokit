import { createKeyedPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveGeocodingApiKey } from 'geokit/config/env/service-keys';
import { MapTilerAPIProvider } from './maptiler-provider.js';

export const maptilerPlugin: GeokitAPIPlugin = {
  name: 'maptiler',
  capabilities: ['geocoding'],
  createProvider: () => new MapTilerAPIProvider(),
  chain: { geocoding: 'prepend' },
};

export const registerMapTilerPlugin = createKeyedPluginRegistrar(
  maptilerPlugin,
  (overrides) => {
    const apiKey = overrides?.maptilerApiKey ?? resolveGeocodingApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { MapTilerAPIProvider } from './maptiler-provider.js';
