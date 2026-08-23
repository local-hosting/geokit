import { registerGeokitPlugin, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveRoutingAccessToken } from 'geokit/config/env/service-keys';
import type { CapabilityRouterEnvOverrides } from '@geokit/api/types/api-composite';
import { getAPIProvider, initAPIProvider } from '@geokit/api/registry';
import { MapboxAPIProvider } from './mapbox-provider.js';

export const mapboxPlugin: GeokitAPIPlugin = {
  name: 'mapbox',
  capabilities: ['geocoding', 'isochrone', 'directions'],
  createProvider: () => new MapboxAPIProvider(),
  chain: { geocoding: 'append', isochrone: 'prepend' },
};

export async function registerMapboxPlugin(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  const accessToken = overrides?.mapboxAccessToken ?? resolveRoutingAccessToken();
  if (!accessToken) return;
  if (getAPIProvider('mapbox')) {
    await initAPIProvider('mapbox', { accessToken });
    return;
  }
  await registerGeokitPlugin(mapboxPlugin, { accessToken });
}

export { MapboxAPIProvider } from './mapbox-provider.js';
