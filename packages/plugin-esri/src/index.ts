import { createKeyedPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveEsriApiKey } from '@geokit/core/config/env/service-keys';
import { EsriPlacesAPIProvider } from './esri-places-provider.js';

export const esriPlacesPlugin: GeokitAPIPlugin = {
  name: 'esri-places',
  capabilities: ['placeSearch'],
  createProvider: () => new EsriPlacesAPIProvider(),
  chain: { placeSearch: 'append' },
};

export const registerEsriPlacesPlugin = createKeyedPluginRegistrar(
  esriPlacesPlugin,
  (overrides) => {
    const apiKey = overrides?.esriApiKey ?? resolveEsriApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export {
  EsriPlacesAPIProvider,
  buildEsriNearPointUrl,
  normalizeEsriPlace,
  isEsriCategoryId,
  esriPlacesHeaders,
} from './esri-places-provider.js';
