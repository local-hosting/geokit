import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@geokit/service/plugin';
import { resolveEsriApiKey } from '@geokit/core/config/env/service-keys';
import { EsriPlacesService } from './esri-places-provider.js';

export const esriPlacesPlugin: GeokitServicePlugin = {
  name: 'esri-places',
  capabilities: ['placeSearch'],
  createService: () => new EsriPlacesService(),
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
  EsriPlacesService,
  buildEsriNearPointUrl,
  normalizeEsriPlace,
  isEsriCategoryId,
  esriPlacesHeaders,
} from './esri-places-provider.js';
