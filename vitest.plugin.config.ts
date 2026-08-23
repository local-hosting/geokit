import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export function pluginVitestAliases(
  pkgRoot: string,
  extraAliases: Record<string, string> = {}
): Record<string, string> {
  const apiRoot = path.resolve(pkgRoot, '../api');
  const coreRoot = path.resolve(pkgRoot, '../core');

  return {
    '@geokit/api/place-taxonomy': path.resolve(apiRoot, 'src/place-taxonomy.ts'),
    '@geokit/api/types': path.resolve(apiRoot, 'src/providers/types.ts'),
    '@geokit/api/types/place-taxonomy': path.resolve(apiRoot, 'src/types/place-taxonomy.ts'),
    '@geokit/api/types/api-composite': path.resolve(apiRoot, 'src/types/api-composite.ts'),
    '@geokit/api/plugin': path.resolve(apiRoot, 'src/plugin.ts'),
    '@geokit/api/registry': path.resolve(apiRoot, 'src/providers/registry.ts'),
    '@geokit/api/setup-capability-routers': path.resolve(
      apiRoot,
      'src/providers/setup-capability-routers.ts'
    ),
    '@geokit/api': path.resolve(apiRoot, 'src/index.ts'),
    'geokit/config/env/service-keys': path.resolve(coreRoot, 'src/config/env/service-keys.ts'),
    'geokit/utils/retry': path.resolve(coreRoot, 'src/utils/retry.ts'),
    'geokit/utils/cache': path.resolve(coreRoot, 'src/utils/cache.ts'),
    '../../../core/tests/fixtures/geojson': path.resolve(coreRoot, 'tests/fixtures/geojson.ts'),
    '../../../core/tests/mocks/fetch': path.resolve(coreRoot, 'tests/mocks/fetch.ts'),
    '../../../core/tests/mocks/mock-api-provider': path.resolve(coreRoot, 'tests/mocks/mock-api-provider.ts'),
    '../../../core/tests/fixtures/locations': path.resolve(coreRoot, 'tests/fixtures/locations.ts'),
    ...extraAliases,
  };
}

export function definePluginVitestConfig(
  metaUrl: string,
  extraAliases: Record<string, string> = {}
) {
  const pkgRoot = path.dirname(fileURLToPath(metaUrl));

  return defineConfig({
    resolve: {
      alias: pluginVitestAliases(pkgRoot, extraAliases),
    },
    test: {
      include: ['tests/**/*.test.ts'],
    },
  });
}
