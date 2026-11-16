import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@doppler-group/geokit/service/plugin';
import { resolveEsriApiKey } from '@doppler-group/geokit/env/service-keys';
import { EsriPlacesService } from './esri-places-service';

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
} from './esri-places-service';
