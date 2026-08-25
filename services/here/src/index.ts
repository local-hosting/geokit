import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@geokit/service/plugin';
import { resolveHereApiKey } from '@geokit/env/service-keys';
import { HerePlacesService } from './here-places-service';

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

export { HerePlacesService, buildHereDiscoverUrl, normalizeHereDiscoverItem } from './here-places-service';
