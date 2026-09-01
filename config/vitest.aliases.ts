import path from 'node:path';

export function pluginVitestAliases(repoRoot: string): Record<string, string> {
  const serviceRoot = path.join(repoRoot, 'src/service');
  const coreRoot = path.join(repoRoot, 'src/core');
  const envRoot = path.join(repoRoot, 'src/env');
  const h3Root = path.join(repoRoot, 'src/h3');
  return {
    '@geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@geokit/service/plugin': path.join(serviceRoot, 'src/plugin.ts'),
    '@geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@geokit/service/setup-capability-routers': path.join(
      serviceRoot,
      'src/setup-capability-routers.ts'
    ),
    '@geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@geokit/env': path.join(envRoot, 'src/index.ts'),
    '@geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@geokit/env/map-credentials': path.join(envRoot, 'src/map-credentials.ts'),
    '@geokit/env/primitives': path.join(envRoot, 'src/primitives.ts'),
    '@geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
    '../../../core/tests/fixtures/geojson': path.join(coreRoot, 'tests/fixtures/geojson.ts'),
    '../../../core/tests/mocks/fetch': path.join(coreRoot, 'tests/mocks/fetch.ts'),
    '../../../core/tests/mocks/mock-api-provider': path.join(
      coreRoot,
      'tests/mocks/mock-api-provider.ts'
    ),
    '../../../core/tests/fixtures/locations': path.join(coreRoot, 'tests/fixtures/locations.ts'),
  };
}

export function serviceVitestAliases(repoRoot: string): Record<string, string> {
  const serviceRoot = path.join(repoRoot, 'src/service');
  const coreRoot = path.join(repoRoot, 'src/core');
  const envRoot = path.join(repoRoot, 'src/env');
  const h3Root = path.join(repoRoot, 'src/h3');

  return {
    '@geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@geokit/foursquare/foursquare-places': path.join(
      repoRoot,
      'src/providers/foursquare/src/foursquare-places.ts'
    ),
    '@geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
    '@geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
    '@geokit/env': path.join(envRoot, 'src/index.ts'),
    '@geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
  };
}
