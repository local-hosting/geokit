import { createOptionalPluginRegistrar, type GeokitServicePlugin } from '@twinfile/geokit/service/plugin';
import { OsmService } from './osm-service';

export const osmPlugin: GeokitServicePlugin = {
  name: 'osm',
  capabilities: ['placeSearch'],
  createService: () => new OsmService(),
  chain: { placeSearch: 'append' },
};

export const registerOsmPlugin = createOptionalPluginRegistrar(osmPlugin);

export { OsmService } from './osm-service';
export type { OsmProviderConfig } from './osm-service';
