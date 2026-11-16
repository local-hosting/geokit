import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@doppler-group/geokit/service/plugin';
import { resolveGeocodingApiKey } from '@doppler-group/geokit/env/service-keys';
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
