import { createKeyedPluginRegistrar, type GeokitServicePlugin } from '@local-hosting/geokit/service/plugin';
import { resolveRoutingAccessToken } from '@local-hosting/geokit/env/service-keys';
import { MapboxService } from './mapbox-service';

export const mapboxPlugin: GeokitServicePlugin = {
  name: 'mapbox',
  capabilities: ['geocoding', 'isochrone', 'directions'],
  createService: () => new MapboxService(),
  chain: { geocoding: 'append', isochrone: 'prepend' },
};

export const registerMapboxPlugin = createKeyedPluginRegistrar(
  mapboxPlugin,
  (overrides) => {
    const accessToken = overrides?.mapboxAccessToken ?? resolveRoutingAccessToken();
    return accessToken ? { accessToken } : null;
  }
);

export { MapboxService } from './mapbox-service';
