import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@local-hosting/geokit/service/plugin';
import { resolveFoursquareApiKey } from '@local-hosting/geokit/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@local-hosting/geokit/service/types/api-composite';
import { FoursquareService } from './foursquare-service';

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
    if (!apiKey) return null;
    return {
      apiKey,
      ...(overrides?.foursquarePlacesApiBase
        ? { baseUrl: overrides.foursquarePlacesApiBase }
        : {}),
    };
  }
);

export { FoursquareService } from './foursquare-service';
export * from './foursquare-places';
export type { FoursquarePlaceRaw } from './types/foursquare-places';
