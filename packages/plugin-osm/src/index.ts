import { createOptionalPluginRegistrar, type GeokitAPIPlugin } from '@geokit/api/plugin';
import { OsmAPIProvider } from './osm-provider.js';

export const osmPlugin: GeokitAPIPlugin = {
  name: 'osm',
  capabilities: ['placeSearch'],
  createProvider: () => new OsmAPIProvider(),
  chain: { placeSearch: 'append' },
};

export const registerOsmPlugin = createOptionalPluginRegistrar(osmPlugin);

export { OsmAPIProvider } from './osm-provider.js';
export type { OsmProviderConfig } from './osm-provider.js';
