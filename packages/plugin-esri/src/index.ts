import { registerGeokitPlugin, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { getAPIProvider, initAPIProvider } from '@geokit/api/registry';
import { resolveEsriApiKey } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { EsriPlacesAPIProvider } from './esri-places-provider.js';

export type EsriPluginOverrides = CapabilityRouterEnvOverrides & {
  esriApiKey?: string;
};

export const esriPlacesPlugin: GeokitAPIPlugin = {
  name: 'esri-places',
  capabilities: ['placeSearch'],
  createProvider: () => new EsriPlacesAPIProvider(),
  chain: { placeSearch: 'append' },
};

export async function registerEsriPlacesPlugin(
  overrides?: EsriPluginOverrides
): Promise<void> {
  const apiKey = overrides?.esriApiKey ?? resolveEsriApiKey();
  if (!apiKey) {
    return;
  }

  if (getAPIProvider('esri-places')) {
    await initAPIProvider('esri-places', { apiKey });
    return;
  }

  await registerGeokitPlugin(esriPlacesPlugin, { apiKey });
}

export {
  EsriPlacesAPIProvider,
  buildEsriNearPointUrl,
  normalizeEsriPlace,
  isEsriCategoryId,
  esriPlacesHeaders,
} from './esri-places-provider.js';
