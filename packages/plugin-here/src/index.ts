import { createKeyedPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveHereApiKey } from '@geokit/core/config/env/service-keys';
import { HerePlacesAPIProvider } from './here-places-provider.js';

export const herePlacesPlugin: GeokitAPIPlugin = {
  name: 'here-places',
  capabilities: ['placeSearch'],
  createProvider: () => new HerePlacesAPIProvider(),
  chain: { placeSearch: 'append' },
};

export const registerHerePlacesPlugin = createKeyedPluginRegistrar(
  herePlacesPlugin,
  (overrides) => {
    const apiKey = overrides?.hereApiKey ?? resolveHereApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { HerePlacesAPIProvider, buildHereDiscoverUrl, normalizeHereDiscoverItem } from './here-places-provider.js';
