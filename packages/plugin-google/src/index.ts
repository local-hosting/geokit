import { createKeyedPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveGooglePlacesApiKey } from 'geokit/config/env/service-keys';
import { GooglePlacesAPIProvider } from './google-places-provider.js';

export const googlePlacesPlugin: GeokitAPIPlugin = {
  name: 'google-places',
  capabilities: ['placeSearch'],
  createProvider: () => new GooglePlacesAPIProvider(),
  chain: { placeSearch: 'append' },
};

export const registerGooglePlacesPlugin = createKeyedPluginRegistrar(
  googlePlacesPlugin,
  (overrides) => {
    const apiKey = overrides?.googlePlacesApiKey ?? resolveGooglePlacesApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { GooglePlacesAPIProvider } from './google-places-provider.js';
