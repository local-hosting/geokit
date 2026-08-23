import { createKeyedPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveFoursquareApiKey } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { FoursquareAPIProvider } from './foursquare-provider.js';

export const foursquarePlugin: GeokitAPIPlugin = {
  name: 'foursquare',
  capabilities: ['placeSearch'],
  createProvider: () => new FoursquareAPIProvider(),
  chain: { placeSearch: 'prepend' },
};

export const registerFoursquarePlugin = createKeyedPluginRegistrar(
  foursquarePlugin,
  (overrides) => {
    const apiKey = overrides?.foursquareApiKey ?? resolveFoursquareApiKey();
    return apiKey ? { apiKey } : null;
  }
);

export { FoursquareAPIProvider } from './foursquare-provider.js';
export * from './foursquare-places.js';
export type { FoursquarePlaceRaw } from './types/foursquare-places.js';
