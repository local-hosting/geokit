import { registerGeokitPlugin, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveGooglePlacesApiKey } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { getAPIProvider, initAPIProvider } from '@geokit/api/registry';
import { GooglePlacesAPIProvider } from './google-places-provider.js';

export const googlePlacesPlugin: GeokitAPIPlugin = {
  name: 'google-places',
  capabilities: ['placeSearch'],
  createProvider: () => new GooglePlacesAPIProvider(),
  chain: { placeSearch: 'append' },
};

export async function registerGooglePlacesPlugin(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  const apiKey = overrides?.googlePlacesApiKey ?? resolveGooglePlacesApiKey();
  if (!apiKey) return;
  if (getAPIProvider('google-places')) {
    await initAPIProvider('google-places', { apiKey });
    return;
  }
  await registerGeokitPlugin(googlePlacesPlugin, { apiKey });
}

export { GooglePlacesAPIProvider } from './google-places-provider.js';
