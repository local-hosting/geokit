import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@geokit/service/plugin';
import { resolveFoursquareApiKey } from '@geokit/core/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/service/types/api-composite';
import { FoursquareService } from './foursquare-provider.js';

export const foursquarePlugin: GeokitServicePlugin = {
  name: 'foursquare',
  capabilities: ['placeSearch'],
  createService: () => new FoursquareService(),
  chain: { placeSearch: 'prepend' },
};

export const registerFoursquarePlugin = createKeyedPluginRegistrar(
  foursquarePlugin,
  (overrides) => {
    const apiKey = overrides?.foursquareApiKey ?? resolveFoursquareApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { FoursquareService } from './foursquare-provider.js';
export * from './foursquare-places.js';
export type { FoursquarePlaceRaw } from './types/foursquare-places.js';
