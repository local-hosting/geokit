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
    '@twinfile/geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@twinfile/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@twinfile/geokit/service/plugin': path.join(serviceRoot, 'src/plugin.ts'),
    '@twinfile/geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@twinfile/geokit/service/setup-capability-routers': path.join(
      serviceRoot,
      'src/setup-capability-routers.ts'
    ),
    '@twinfile/geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@twinfile/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@twinfile/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@twinfile/geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@twinfile/geokit/env/map-credentials': path.join(envRoot, 'src/map-credentials.ts'),
    '@twinfile/geokit/env/primitives': path.join(envRoot, 'src/primitives.ts'),
    '@twinfile/geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@twinfile/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@twinfile/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@twinfile/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@twinfile/geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@twinfile/geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
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
    '@twinfile/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@twinfile/geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@twinfile/geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@twinfile/geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@twinfile/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@twinfile/geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@twinfile/geokit/foursquare/foursquare-places': path.join(
      repoRoot,
      'src/providers/foursquare/src/foursquare-places.ts'
    ),
    '@twinfile/geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
    '@twinfile/geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@twinfile/geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@twinfile/geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@twinfile/geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
    '@twinfile/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@twinfile/geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@twinfile/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@twinfile/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@twinfile/geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
  };
}


export function coreVitestAliases(repoRoot: string): Record<string, string> {
  const coreRoot = path.join(repoRoot, 'src/core');
  const uiRoot = path.join(repoRoot, 'src/ui');
  const envRoot = path.join(repoRoot, 'src/env');
  const h3Root = path.join(repoRoot, 'src/h3');
  const serviceRoot = path.join(repoRoot, 'src/service');
  return {
    '@twinfile/geokit/core': path.join(coreRoot, 'src/index.ts'),
    '@twinfile/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@twinfile/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@twinfile/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@twinfile/geokit/env/bootstrap': path.join(envRoot, 'src/bootstrap.ts'),
    '@twinfile/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@twinfile/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@twinfile/geokit/ui/config/map-style': path.join(uiRoot, 'src/config/map-style.ts'),
    '@twinfile/geokit/ui/layer-styles': path.join(uiRoot, 'src/layer-styles.ts'),
    '@twinfile/geokit/ui/elements/map-collection': path.join(uiRoot, 'src/elements/map-collection.ts'),
    '@twinfile/geokit/ui/elements/popup': path.join(uiRoot, 'src/elements/popup.ts'),
    '@twinfile/geokit/ui/elements/isochrone': path.join(uiRoot, 'src/elements/isochrone.ts'),
    '@twinfile/geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@twinfile/geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@twinfile/geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@twinfile/geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
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
