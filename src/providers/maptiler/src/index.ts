import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@local-hosting/geokit/service/plugin';
import { resolveGeocodingApiKey } from '@local-hosting/geokit/env/service-keys';
import { MapTilerService } from './maptiler-service';

export const maptilerPlugin: GeokitServicePlugin = {
  name: 'maptiler',
  capabilities: ['geocoding'],
  createService: () => new MapTilerService(),
  chain: { geocoding: 'prepend' },
};

export const registerMapTilerPlugin = createKeyedPluginRegistrar(
  maptilerPlugin,
  (overrides) => {
    const apiKey = overrides?.maptilerApiKey ?? resolveGeocodingApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { MapTilerService } from './maptiler-service';
