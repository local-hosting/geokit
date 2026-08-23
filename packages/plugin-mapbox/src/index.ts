import { createKeyedPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { resolveRoutingAccessToken } from '@geokit/core/config/env/service-keys';
import { MapboxAPIProvider } from './mapbox-provider.js';

export const mapboxPlugin: GeokitAPIPlugin = {
  name: 'mapbox',
  capabilities: ['geocoding', 'isochrone', 'directions'],
  createProvider: () => new MapboxAPIProvider(),
  chain: { geocoding: 'append', isochrone: 'prepend' },
};

export const registerMapboxPlugin = createKeyedPluginRegistrar(
  mapboxPlugin,
  (overrides) => {
    const accessToken = overrides?.mapboxAccessToken ?? resolveRoutingAccessToken();
    return accessToken ? { accessToken } : null;
  }
);

export { MapboxAPIProvider } from './mapbox-provider.js';
