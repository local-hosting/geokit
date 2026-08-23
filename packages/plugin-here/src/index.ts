import { registerGeokitPlugin, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { getAPIProvider, initAPIProvider } from '@geokit/api/registry';
import { resolveHereApiKey } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { HerePlacesAPIProvider } from './here-places-provider.js';

export type HerePluginOverrides = CapabilityRouterEnvOverrides & {
  hereApiKey?: string;
};

export const herePlacesPlugin: GeokitAPIPlugin = {
  name: 'here-places',
  capabilities: ['placeSearch'],
  createProvider: () => new HerePlacesAPIProvider(),
  chain: { placeSearch: 'append' },
};

export async function registerHerePlacesPlugin(
  overrides?: HerePluginOverrides
): Promise<void> {
  const apiKey = overrides?.hereApiKey ?? resolveHereApiKey();
  if (!apiKey) {
    return;
  }

  if (getAPIProvider('here-places')) {
    await initAPIProvider('here-places', { apiKey });
    return;
  }

  await registerGeokitPlugin(herePlacesPlugin, { apiKey });
}

export { HerePlacesAPIProvider, buildHereDiscoverUrl, normalizeHereDiscoverItem } from './here-places-provider.js';
