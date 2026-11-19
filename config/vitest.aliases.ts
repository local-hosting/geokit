import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGeokitVitestAliases } from '../scripts/geokit-vitest-aliases.mjs';

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function pluginVitestAliases(repoRoot: string): Record<string, string> {
  const serviceRoot = path.join(repoRoot, 'src/service');
  const coreRoot = path.join(repoRoot, 'src/core');
  const envRoot = path.join(repoRoot, 'src/env');
  const h3Root = path.join(repoRoot, 'src/h3');
  return {
    '@local-hosting/geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@local-hosting/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@local-hosting/geokit/service/plugin': path.join(serviceRoot, 'src/plugin.ts'),
    '@local-hosting/geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@local-hosting/geokit/service/setup-capability-routers': path.join(
      serviceRoot,
      'src/setup-capability-routers.ts'
    ),
    '@local-hosting/geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@local-hosting/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@local-hosting/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@local-hosting/geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@local-hosting/geokit/env/map-credentials': path.join(envRoot, 'src/map-credentials.ts'),
    '@local-hosting/geokit/env/primitives': path.join(envRoot, 'src/primitives.ts'),
    '@local-hosting/geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@local-hosting/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@local-hosting/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@local-hosting/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@local-hosting/geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@local-hosting/geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
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
    '@local-hosting/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@local-hosting/geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@local-hosting/geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@local-hosting/geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@local-hosting/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@local-hosting/geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@local-hosting/geokit/foursquare/foursquare-places': path.join(
      repoRoot,
      'src/providers/foursquare/src/foursquare-places.ts'
    ),
    '@local-hosting/geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
    '@local-hosting/geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@local-hosting/geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@local-hosting/geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@local-hosting/geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
    '@local-hosting/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@local-hosting/geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@local-hosting/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@local-hosting/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@local-hosting/geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
  };
}


export function coreVitestAliases(repoRoot: string): Record<string, string> {
  const coreRoot = path.join(repoRoot, 'src/core');
  const uiRoot = path.join(repoRoot, 'src/ui');
  const envRoot = path.join(repoRoot, 'src/env');
  const h3Root = path.join(repoRoot, 'src/h3');
  const serviceRoot = path.join(repoRoot, 'src/service');
  return {
    '@local-hosting/geokit/core': path.join(coreRoot, 'src/index.ts'),
    '@local-hosting/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@local-hosting/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@local-hosting/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@local-hosting/geokit/env/bootstrap': path.join(envRoot, 'src/bootstrap.ts'),
    '@local-hosting/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@local-hosting/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@local-hosting/geokit/ui/config/map-style': path.join(uiRoot, 'src/config/map-style.ts'),
    '@local-hosting/geokit/ui/layer-styles': path.join(uiRoot, 'src/layer-styles.ts'),
    '@local-hosting/geokit/ui/elements/map-collection': path.join(uiRoot, 'src/elements/map-collection.ts'),
    '@local-hosting/geokit/ui/elements/popup': path.join(uiRoot, 'src/elements/popup.ts'),
    '@local-hosting/geokit/ui/elements/isochrone': path.join(uiRoot, 'src/elements/isochrone.ts'),
    '@local-hosting/geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@local-hosting/geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@local-hosting/geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@local-hosting/geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
  };
}


export function loadGeokitVitestAliases(repoRoot = defaultRepoRoot): Record<string, string> {
  return buildGeokitVitestAliases(repoRoot);
}

export function vitestAliasEntries(aliases: Record<string, string>) {
  return Object.entries(aliases)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([find, replacement]) => ({ find, replacement }));
}
