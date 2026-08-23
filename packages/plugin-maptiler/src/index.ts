import { registerGeokitPlugin, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveGeocodingApiKey } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { getAPIProvider, initAPIProvider } from '@geokit/api/registry';
import { MapTilerAPIProvider } from './maptiler-provider.js';

export const maptilerPlugin: GeokitAPIPlugin = {
  name: 'maptiler',
  capabilities: ['geocoding'],
  createProvider: () => new MapTilerAPIProvider(),
  chain: { geocoding: 'prepend' },
};

export async function registerMapTilerPlugin(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  const apiKey = overrides?.maptilerApiKey ?? resolveGeocodingApiKey();
  if (!apiKey) return;
  if (getAPIProvider('maptiler')) {
    await initAPIProvider('maptiler', { apiKey });
    return;
  }
  await registerGeokitPlugin(maptilerPlugin, { apiKey });
}

export { MapTilerAPIProvider } from './maptiler-provider.js';
