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
    '@doppler-group/geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@doppler-group/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@doppler-group/geokit/service/plugin': path.join(serviceRoot, 'src/plugin.ts'),
    '@doppler-group/geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@doppler-group/geokit/service/setup-capability-routers': path.join(
      serviceRoot,
      'src/setup-capability-routers.ts'
    ),
    '@doppler-group/geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@doppler-group/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@doppler-group/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@doppler-group/geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@doppler-group/geokit/env/map-credentials': path.join(envRoot, 'src/map-credentials.ts'),
    '@doppler-group/geokit/env/primitives': path.join(envRoot, 'src/primitives.ts'),
    '@doppler-group/geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@doppler-group/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@doppler-group/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@doppler-group/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@doppler-group/geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@doppler-group/geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
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
    '@doppler-group/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@doppler-group/geokit/service/builtins': path.join(serviceRoot, 'src/builtins.ts'),
    '@doppler-group/geokit/service/registry': path.join(serviceRoot, 'src/src/providers/registry.ts'),
    '@doppler-group/geokit/service/types': path.join(serviceRoot, 'src/src/providers/types.ts'),
    '@doppler-group/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@doppler-group/geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@doppler-group/geokit/foursquare/foursquare-places': path.join(
      repoRoot,
      'src/providers/foursquare/src/foursquare-places.ts'
    ),
    '@doppler-group/geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
    '@doppler-group/geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@doppler-group/geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@doppler-group/geokit/core/utils/retry': path.join(coreRoot, 'src/utils/retry.ts'),
    '@doppler-group/geokit/core/utils/cache': path.join(coreRoot, 'src/utils/cache.ts'),
    '@doppler-group/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@doppler-group/geokit/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
    '@doppler-group/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@doppler-group/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
    '@doppler-group/geokit/core/config/env/service-keys': path.join(envRoot, 'src/service-keys.ts'),
  };
}


export function coreVitestAliases(repoRoot: string): Record<string, string> {
  const coreRoot = path.join(repoRoot, 'src/core');
  const uiRoot = path.join(repoRoot, 'src/ui');
  const envRoot = path.join(repoRoot, 'src/env');
  const h3Root = path.join(repoRoot, 'src/h3');
  const serviceRoot = path.join(repoRoot, 'src/service');
  return {
    '@doppler-group/geokit/core': path.join(coreRoot, 'src/index.ts'),
    '@doppler-group/geokit/service': path.join(serviceRoot, 'src/index.ts'),
    '@doppler-group/geokit/service/types/api-composite': path.join(serviceRoot, 'src/types/api-composite.ts'),
    '@doppler-group/geokit/env': path.join(envRoot, 'src/index.ts'),
    '@doppler-group/geokit/env/bootstrap': path.join(envRoot, 'src/bootstrap.ts'),
    '@doppler-group/geokit/h3': path.join(h3Root, 'src/index.ts'),
    '@doppler-group/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
    '@doppler-group/geokit/ui/config/map-style': path.join(uiRoot, 'src/config/map-style.ts'),
    '@doppler-group/geokit/ui/layer-styles': path.join(uiRoot, 'src/layer-styles.ts'),
    '@doppler-group/geokit/ui/elements/map-collection': path.join(uiRoot, 'src/elements/map-collection.ts'),
    '@doppler-group/geokit/ui/elements/popup': path.join(uiRoot, 'src/elements/popup.ts'),
    '@doppler-group/geokit/ui/elements/isochrone': path.join(uiRoot, 'src/elements/isochrone.ts'),
    '@doppler-group/geokit/mapbox': path.join(repoRoot, 'src/providers/mapbox/src/index.ts'),
    '@doppler-group/geokit/maptiler': path.join(repoRoot, 'src/providers/maptiler/src/index.ts'),
    '@doppler-group/geokit/foursquare': path.join(repoRoot, 'src/providers/foursquare/src/index.ts'),
    '@doppler-group/geokit/google': path.join(repoRoot, 'src/providers/google/src/index.ts'),
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
