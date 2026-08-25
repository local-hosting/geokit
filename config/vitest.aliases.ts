import path from 'node:path';

export function pluginVitestAliases(repoRoot: string): Record<string, string> {
  const serviceRoot = path.join(repoRoot, 'packages/service');
  const coreRoot = path.join(repoRoot, 'packages/core');
  const geotypesRoot = path.join(repoRoot, 'packages/geotypes');

  return {
    '@geokit/service/place-taxonomy': path.join(serviceRoot, 'src/place-taxonomy.ts'),
    '@geokit/service/types': path.join(serviceRoot, 'src/services/types.ts'),
    '@geokit/service/types/place-taxonomy': path.join(serviceRoot, 'src/types/place-taxonomy.ts'),
    '@geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@geokit/service/plugin': path.join(serviceRoot, 'src/plugin.ts'),
    '@geokit/service/registry': path.join(serviceRoot, 'src/services/registry.ts'),
    '@geokit/service/setup-capability-routers': path.join(
      serviceRoot,
      'src/setup-capability-routers.ts'
    ),
    '@geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@geokit/core/config/env/service-keys': path.join(coreRoot, 'src/config/env/service-keys.ts'),
    '@geokit/geotypes/geokit': path.join(geotypesRoot, 'src/geokit-adapter.ts'),
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
  const serviceRoot = path.join(repoRoot, 'packages/service');
  const coreRoot = path.join(repoRoot, 'packages/core');

  return {
    '@geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@geokit/service/place-taxonomy': path.join(serviceRoot, 'src/place-taxonomy.ts'),
    '@geokit/service/registry': path.join(serviceRoot, 'src/services/registry.ts'),
    '@geokit/service/types': path.join(serviceRoot, 'src/services/types.ts'),
    '@geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@geokit/service/types/place-taxonomy': path.join(serviceRoot, 'src/types/place-taxonomy.ts'),
    '@geokit/foursquare': path.join(repoRoot, 'services/foursquare/src/index.ts'),
    '@geokit/foursquare/foursquare-places': path.join(
      repoRoot,
      'services/foursquare/src/foursquare-places.ts'
    ),
    '@geokit/google': path.join(repoRoot, 'services/google/src/index.ts'),
    '@geokit/mapbox': path.join(repoRoot, 'services/mapbox/src/index.ts'),
    '@geokit/maptiler': path.join(repoRoot, 'services/maptiler/src/index.ts'),
    '@geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
    '@geokit/core/config/env/service-keys': path.join(coreRoot, 'src/config/env/service-keys.ts'),
  };
}

export function geotypesVitestAliases(repoRoot: string): Record<string, string> {
  const serviceRoot = path.join(repoRoot, 'packages/service');

  return {
    '@geokit/service/types/place-taxonomy': path.join(serviceRoot, 'src/types/place-taxonomy.ts'),
    '@geokit/service/place-taxonomy': path.join(serviceRoot, 'src/place-taxonomy.ts'),
  };
}
