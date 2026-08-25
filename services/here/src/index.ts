import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@geokit/service/plugin';
import { resolveHereApiKey } from '@geokit/core/config/env/service-keys';
import { HerePlacesService } from './here-places-provider.js';

export const herePlacesPlugin: GeokitServicePlugin = {
  name: 'here-places',
  capabilities: ['placeSearch'],
  createService: () => new HerePlacesService(),
  chain: { placeSearch: 'append' },
};

export const registerHerePlacesPlugin = createKeyedPluginRegistrar(
  herePlacesPlugin,
  (overrides) => {
    const apiKey = overrides?.hereApiKey ?? resolveHereApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { HerePlacesService, buildHereDiscoverUrl, normalizeHereDiscoverItem } from './here-places-provider.js';
