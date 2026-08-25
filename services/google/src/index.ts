import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@geokit/service/plugin';
import { resolveGooglePlacesApiKey } from '@geokit/core/config/env/service-keys';
import { GooglePlacesService } from './google-places-provider.js';

export const googlePlacesPlugin: GeokitServicePlugin = {
  name: 'google-places',
  capabilities: ['placeSearch'],
  createService: () => new GooglePlacesService(),
  chain: { placeSearch: 'append' },
};

export const registerGooglePlacesPlugin = createKeyedPluginRegistrar(
  googlePlacesPlugin,
  (overrides) => {
    const apiKey = overrides?.googlePlacesApiKey ?? resolveGooglePlacesApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { GooglePlacesService } from './google-places-provider.js';
