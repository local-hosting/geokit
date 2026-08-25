import { createOptionalPluginRegistrar, type GeokitServicePlugin } from '@geokit/service/plugin';
import { OsmService } from './osm-service.js';

export const osmPlugin: GeokitServicePlugin = {
  name: 'osm',
  capabilities: ['placeSearch'],
  createService: () => new OsmService(),
  chain: { placeSearch: 'append' },
};

export const registerOsmPlugin = createOptionalPluginRegistrar(osmPlugin);

export { OsmService } from './osm-service.js';
export type { OsmProviderConfig } from './osm-service.js';
