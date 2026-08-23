import { registerGeokitPlugin, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveFoursquareApiKey } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { getAPIProvider, initAPIProvider } from '@geokit/api/registry';
import { FoursquareAPIProvider } from './foursquare-provider.js';

export const foursquarePlugin: GeokitAPIPlugin = {
  name: 'foursquare',
  capabilities: ['placeSearch'],
  createProvider: () => new FoursquareAPIProvider(),
  chain: { placeSearch: 'prepend' },
};

export async function registerFoursquarePlugin(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  const apiKey = overrides?.foursquareApiKey ?? resolveFoursquareApiKey();
  if (!apiKey) return;
  if (getAPIProvider('foursquare')) {
    await initAPIProvider('foursquare', { apiKey });
    return;
  }
  await registerGeokitPlugin(foursquarePlugin, { apiKey });
}

export { FoursquareAPIProvider } from './foursquare-provider.js';
export * from './foursquare-places.js';
export type { FoursquarePlaceRaw } from './types/foursquare-places.js';
